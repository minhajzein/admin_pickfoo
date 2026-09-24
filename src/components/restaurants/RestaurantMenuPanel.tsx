"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  Edit2,
  ImageIcon,
  Import,
  Loader2,
  Plus,
  Search,
  Tag,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCategoryForRestaurant,
  createRestaurantMenuItem,
  deleteCategory,
  deleteRestaurantMenuItem,
  fetchCategories,
  fetchRestaurantMenu,
  importRestaurantMenu,
  type AdminCategory,
  type AdminMenuItem,
  type AdminMenuItemInput,
  type AdminMenuVariant,
  updateCategory,
  updateRestaurantMenuItem,
  uploadMenuImage,
} from "@/lib/api/menu";
import {
  searchRestaurants,
  type RestaurantListItem,
} from "@/lib/api/restaurants";
import { fetchCustomerOffers } from "@/lib/api/customer-offers";
import { unitOfferPrice } from "@/lib/menuOfferPrice";
import { CustomerStyleMenuCard } from "@/components/restaurants/CustomerStyleMenuCard";
import { OfferPrice } from "@/components/ui/OfferPrice";
import { CategorySearchField, categoryParentId, categoryParentName } from "@/components/restaurants/CategorySearchField";
import { RESTAURANT_TYPES, type RestaurantType } from "@/types/models";

type MealType = "breakfast" | "lunch" | "dinner";

const DEFAULT_COMMISSION_PERCENT = 12;

/** Yield past the next paint so click INP isn't charged for dialog mount. */
function afterNextPaint(fn: () => void) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(fn);
  });
}

const RESTAURANT_TYPE_LABELS: Record<RestaurantType, string> = {
  restaurant: "Restaurant",
  cafe: "Cafe",
  bakery: "Bakery",
  coolbar: "Cool Bar",
  hotbar: "Hot Bar",
  home_made: "Home Made",
};

/** Raise partner price by commission % (rounded to nearest rupee). */
function raisedPrice(original: number, percent: number): number {
  const base = Number.isFinite(original) && original > 0 ? original : 0;
  const pct = Number.isFinite(percent) ? percent : 0;
  return Math.round((base * (100 + pct)) / 100);
}

/** Back-calculate original from a stored final price. */
function originalFromFinal(finalPrice: number, percent: number): number {
  const final = Number.isFinite(finalPrice) && finalPrice > 0 ? finalPrice : 0;
  const pct = Number.isFinite(percent) ? percent : 0;
  const factor = 100 + pct;
  if (factor <= 0) return final;
  return Math.round((final * 100) / factor);
}

const emptyForm = (
  restaurantTypes: string[] = ["restaurant"],
): AdminMenuItemInput & { variants: AdminMenuVariant[]; categories: string[] } => ({
  name: "",
  description: "",
  price: 0,
  category: "",
  categories: [],
  type: "lunch",
  mealTypes: ["lunch"],
  preparationTime: 0,
  packingCharge: 0,
  variants: [],
  isVeg: true,
  isActive: true,
  isFeatured: false,
  pause: null,
  inactiveUntil: null,
  availableFrom: "",
  availableTo: "",
  availableSlots: [],
  image: "",
  ingredients: [],
  restaurantTypes:
    restaurantTypes.length > 0 ? [...restaurantTypes] : ["restaurant"],
  completeMealItemIds: [],
});

function menuItemAvailabilitySlots(
  item: Pick<AdminMenuItem, "availableFrom" | "availableTo" | "availableSlots">,
): { from: string; to: string }[] {
  if (item.availableSlots && item.availableSlots.length > 0) {
    return item.availableSlots
      .map((s) => ({
        from: (s.from ?? "").trim(),
        to: (s.to ?? "").trim(),
      }))
      .filter((s) => s.from && s.to);
  }
  const from = (item.availableFrom ?? "").trim();
  const to = (item.availableTo ?? "").trim();
  return from && to ? [{ from, to }] : [];
}

function menuItemCategories(item: Pick<AdminMenuItem, "category" | "categories">): string[] {
  if (item.categories && item.categories.length > 0) {
    return item.categories.map((c) => c.trim()).filter(Boolean);
  }
  const single = item.category?.trim();
  return single ? [single] : [];
}

function normalizeRelatedItemIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .map((id) => {
          if (typeof id === "string") return id.trim();
          if (id && typeof id === "object" && "_id" in id) {
            return String((id as { _id: unknown })._id).trim();
          }
          return String(id ?? "").trim();
        })
        .filter(Boolean),
    ),
  ];
}

function validateForm(
  form: AdminMenuItemInput & { categories?: string[] },
): string | null {
  if (!form.name.trim() || form.name.trim().length < 2) {
    return "Item name must be at least 2 characters";
  }
  if (!form.description.trim() || form.description.trim().length < 10) {
    return "Description must be at least 10 characters";
  }
  const cats = (form.categories ?? [])
    .map((c) => c.trim())
    .filter(Boolean);
  if (cats.length === 0 && !form.category.trim()) {
    return "Select at least one category";
  }
  if (!Number.isFinite(form.price) || form.price <= 0) {
    return "Enter an original price so the final raised price is greater than 0";
  }
  for (const variant of form.variants ?? []) {
    if (!variant.name?.trim()) return "Each variant needs a name";
    if (!Number.isFinite(variant.price) || variant.price <= 0) {
      return `Variant "${variant.name}" needs an original price so final is > 0`;
    }
  }
  if (!form.mealTypes || form.mealTypes.length === 0) {
    return "Select at least one meal type";
  }
  if (!form.restaurantTypes || form.restaurantTypes.length === 0) {
    return "Select at least one restaurant type";
  }
  const slots = (form.availableSlots ?? [])
    .map((s) => ({
      from: (s.from ?? "").trim(),
      to: (s.to ?? "").trim(),
    }))
    .filter((s) => s.from || s.to);
  const hhmm = /^([01]\d|2[0-3]):([0-5]\d)$/;
  for (const slot of slots) {
    if (!slot.from || !slot.to) {
      return "Each schedule needs both from and to times";
    }
    if (!hhmm.test(slot.from) || !hhmm.test(slot.to)) {
      return "Schedule times must be HH:mm";
    }
  }
  return null;
}

/**
 * Uncontrolled + debounced: keystrokes never re-render the menu grid
 * (which was causing ~200–300ms INP on this search input).
 */
const MenuSearchInput = memo(function MenuSearchInput({
  onSearch,
}: {
  onSearch: (query: string) => void;
}) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
        size={16}
      />
      <Input
        defaultValue=""
        placeholder="Search items..."
        className="pl-10 bg-white/5 border-white/10 text-white"
        onChange={(e) => {
          const value = e.target.value;
          if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
          }
          timerRef.current = window.setTimeout(() => {
            startTransition(() => onSearch(value));
          }, 200);
        }}
      />
    </div>
  );
});

export function RestaurantMenuPanel({
  restaurantId,
  restaurantName,
  restaurantTypes: restaurantTypeDefaults = ["restaurant"],
}: {
  restaurantId: string;
  restaurantName?: string;
  /** Types configured on this restaurant — used to seed new items. */
  restaurantTypes?: string[];
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  /** Mount heavy item form after dialog shell paints. */
  const [itemFormReady, setItemFormReady] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [form, setForm] = useState(() => emptyForm(restaurantTypeDefaults));
  const [ingredientInput, setIngredientInput] = useState("");
  const [relatedItemSearch, setRelatedItemSearch] = useState("");
  /** Category names used to filter “complete your meal” candidates (multi-select). */
  const [relatedItemCategories, setRelatedItemCategories] = useState<string[]>(
    [],
  );
  const [commissionPercent, setCommissionPercent] = useState(
    DEFAULT_COMMISSION_PERCENT,
  );
  const [originalPrice, setOriginalPrice] = useState(0);
  const [originalVariantPrices, setOriginalVariantPrices] = useState<number[]>(
    [],
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryListSearch, setCategoryListSearch] = useState("");
  const [debouncedCategoryListSearch, setDebouncedCategoryListSearch] =
    useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryImage, setNewCategoryImage] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState("");
  const [newCategoryParentLabel, setNewCategoryParentLabel] = useState("");
  const [isUploadingCategoryImage, setIsUploadingCategoryImage] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryImage, setEditingCategoryImage] = useState("");
  /** Display URL when edit started; used so we only PATCH image when it changes. */
  const [editingCategoryImageBaseline, setEditingCategoryImageBaseline] =
    useState("");
  const [editingCategoryParentId, setEditingCategoryParentId] = useState("");
  const [editingCategoryParentLabel, setEditingCategoryParentLabel] =
    useState("");
  const [isUploadingEditingCategoryImage, setIsUploadingEditingCategoryImage] =
    useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "item" | "category";
    id: string;
    name: string;
    linkedMenuItemCount?: number;
  } | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSearch, setImportSearch] = useState("");
  const [debouncedImportSearch, setDebouncedImportSearch] = useState("");
  const [selectedSource, setSelectedSource] =
    useState<RestaurantListItem | null>(null);
  const [skipExistingNames, setSkipExistingNames] = useState(true);
  const [selectedImportItemIds, setSelectedImportItemIds] = useState<
    Set<string>
  >(new Set());
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedCategoryListSearch(categoryListSearch.trim());
    }, 250);
    return () => window.clearTimeout(t);
  }, [categoryListSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedImportSearch(importSearch.trim());
    }, 250);
    return () => window.clearTimeout(t);
  }, [importSearch]);

  const { data: menuItems = [], isLoading: isMenuLoading } = useQuery({
    queryKey: ["restaurant-menu", restaurantId],
    queryFn: () => fetchRestaurantMenu(restaurantId),
  });

  const { data: restaurantOffers = [] } = useQuery({
    queryKey: ["restaurant-menu-offers", restaurantId],
    queryFn: async () => {
      const page = await fetchCustomerOffers({
        status: "active",
        page: 1,
        limit: 100,
      });
      return page.data.filter((o) => {
        if (!o.isActive) return false;
        if (o.scope === "restaurants") {
          return (o.restaurantIds || []).includes(restaurantId);
        }
        if (o.type === "combo") {
          return !o.comboRestaurantId || o.comboRestaurantId === restaurantId;
        }
        // Item / BOGO / percent offers — unitOfferPrice decides per dish.
        return (
          o.scope === "items" ||
          o.type === "bogo" ||
          o.type === "percent" ||
          (o.menuItemIds || []).length > 0
        );
      });
    },
  });

  const offerPriceByItemId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of menuItems) {
      const list =
        item.variants && item.variants.length > 0
          ? Math.min(...item.variants.map((v) => v.price))
          : item.price;
      const offer = unitOfferPrice({
        listPrice: list,
        menuItemId: item._id,
        restaurantId,
        offers: restaurantOffers,
        explicitOfferPrice: item.offerPrice,
      });
      if (offer != null) map.set(item._id, offer);
    }
    return map;
  }, [menuItems, restaurantId, restaurantOffers]);

  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ["menu-categories", debouncedCategoryListSearch],
    queryFn: () =>
      fetchCategories({
        search: debouncedCategoryListSearch || undefined,
        limit: debouncedCategoryListSearch ? 50 : 200,
      }),
    enabled: isCategoryModalOpen,
  });

  const { data: importRestaurantOptions = [], isFetching: isImportSearchLoading } =
    useQuery({
      queryKey: ["menu-import-restaurants", debouncedImportSearch],
      queryFn: () =>
        searchRestaurants({
          search: debouncedImportSearch || undefined,
          page: 1,
          limit: 20,
        }),
      enabled: isImportModalOpen,
      staleTime: 30_000,
    });

  const importCandidates = useMemo(
    () => importRestaurantOptions.filter((r) => r._id !== restaurantId),
    [importRestaurantOptions, restaurantId],
  );

  const {
    data: sourceMenuItems = [],
    isLoading: isSourceMenuLoading,
    isFetching: isSourceMenuFetching,
  } = useQuery({
    queryKey: ["restaurant-menu", selectedSource?._id],
    queryFn: () => fetchRestaurantMenu(selectedSource!._id),
    enabled: isImportModalOpen && !!selectedSource?._id,
  });

  useEffect(() => {
    if (!selectedSource) {
      setSelectedImportItemIds(new Set());
      return;
    }
    setSelectedImportItemIds(new Set(sourceMenuItems.map((item) => item._id)));
  }, [selectedSource, sourceMenuItems]);

  const categoryTreeRows = useMemo(() => {
    type Row = { cat: AdminCategory; level: number };
    const byId = new Map(categories.map((c) => [c._id, c]));
    const children = new Map<string | null, AdminCategory[]>();

    for (const cat of categories) {
      let p = categoryParentId(cat);
      if (p && !byId.has(p)) p = null;
      const list = children.get(p) ?? [];
      list.push(cat);
      children.set(p, list);
    }

    for (const list of children.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    const rows: Row[] = [];
    const walk = (parentKey: string | null, level: number) => {
      for (const cat of children.get(parentKey) ?? []) {
        rows.push({ cat, level });
        walk(cat._id, level + 1);
      }
    };
    walk(null, 0);

    // If searching, also include matches that weren't reached via walk roots
    // (already covered when parent missing → treated as root).
    if (debouncedCategoryListSearch && rows.length === 0) {
      return categories.map((cat) => ({ cat, level: 0 }));
    }
    return rows;
  }, [categories, debouncedCategoryListSearch]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter((item) => {
      const cats = menuItemCategories(item).join(" ").toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        cats.includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [menuItems, search]);

  const relatedItemCategoryOptions = useMemo(() => {
    const names = new Set<string>();
    for (const item of menuItems) {
      if (editingItemId && item._id === editingItemId) continue;
      if (!item.isActive) continue;
      for (const name of menuItemCategories(item)) {
        names.add(name);
      }
    }
    return Array.from(names).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [menuItems, editingItemId]);

  const relatedItemCandidates = useMemo(() => {
    const q = relatedItemSearch.trim().toLowerCase();
    const categoryFilter = new Set(
      relatedItemCategories.map((c) => c.trim().toLowerCase()).filter(Boolean),
    );
    return menuItems.filter((item) => {
      if (editingItemId && item._id === editingItemId) return false;
      if (!item.isActive) return false;
      const itemCats = menuItemCategories(item).map((c) => c.toLowerCase());
      if (
        categoryFilter.size > 0 &&
        !itemCats.some((c) => categoryFilter.has(c))
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        itemCats.some((c) => c.includes(q))
      );
    });
  }, [menuItems, editingItemId, relatedItemSearch, relatedItemCategories]);

  const selectedRelatedItems = useMemo(() => {
    const ids = new Set(form.completeMealItemIds ?? []);
    return menuItems.filter((item) => ids.has(item._id));
  }, [menuItems, form.completeMealItemIds]);

  const toggleRelatedItemCategory = (category: string) => {
    setRelatedItemCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  const invalidateMenu = () => {
    queryClient.invalidateQueries({ queryKey: ["restaurant-menu", restaurantId] });
  };
  const invalidateCategories = () => {
    queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
  };

  const resetImportModal = () => {
    setImportSearch("");
    setDebouncedImportSearch("");
    setSelectedSource(null);
    setSkipExistingNames(true);
    setSelectedImportItemIds(new Set());
    setIsImporting(false);
  };

  const openImportModal = () => {
    resetImportModal();
    setIsImportModalOpen(true);
  };

  const toggleImportItem = (itemId: string) => {
    setSelectedImportItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectAllImportItems = () => {
    setSelectedImportItemIds(new Set(sourceMenuItems.map((item) => item._id)));
  };

  const clearImportItemSelection = () => {
    setSelectedImportItemIds(new Set());
  };

  const handleImportMenu = async () => {
    if (!selectedSource) {
      toast.error("Select a source restaurant");
      return;
    }
    if (selectedImportItemIds.size === 0) {
      toast.error("Select at least one menu item to import");
      return;
    }
    setIsImporting(true);
    try {
      const result = await importRestaurantMenu(restaurantId, {
        sourceRestaurantId: selectedSource._id,
        itemIds: [...selectedImportItemIds],
        skipExistingNames,
      });
      invalidateMenu();
      toast.success(
        result.message ||
          `Imported ${result.data.imported} item(s)${
            result.data.skipped > 0
              ? ` (skipped ${result.data.skipped})`
              : ""
          }`,
      );
      setIsImportModalOpen(false);
      resetImportModal();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      toast.error(msg || "Failed to import menu");
    } finally {
      setIsImporting(false);
    }
  };

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      deleteRestaurantMenuItem(restaurantId, itemId),
    onSuccess: () => {
      invalidateMenu();
      toast.success("Menu item deleted");
      setDeleteTarget(null);
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      toast.error(msg || "Failed to delete menu item");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({
      itemId,
      isActive,
      pause,
    }: {
      itemId: string;
      isActive: boolean;
      pause?: "today" | null;
    }) =>
      updateRestaurantMenuItem(
        restaurantId,
        itemId,
        pause === "today"
          ? { pause: "today", isActive: false }
          : { isActive, inactiveUntil: null },
      ),
    onMutate: async ({ itemId, isActive, pause }) => {
      await queryClient.cancelQueries({
        queryKey: ["restaurant-menu", restaurantId],
      });
      const previous = queryClient.getQueryData<AdminMenuItem[]>([
        "restaurant-menu",
        restaurantId,
      ]);
      queryClient.setQueryData<AdminMenuItem[]>(
        ["restaurant-menu", restaurantId],
        (current) =>
          (current ?? []).map((item) =>
            item._id === itemId
              ? {
                  ...item,
                  isActive,
                  inactiveUntil:
                    pause === "today"
                      ? new Date(
                          Date.now() + 24 * 60 * 60 * 1000,
                        ).toISOString()
                      : null,
                }
              : item,
          ),
      );
      return { previous };
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.isActive
          ? "Menu item activated"
          : variables.pause === "today"
            ? "Off today — auto-on at schedule start"
            : "Menu item set to off",
      );
    },
    onError: (err: unknown, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["restaurant-menu", restaurantId],
          context.previous,
        );
      }
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      toast.error(msg || "Failed to update menu status");
    },
    onSettled: () => {
      invalidateMenu();
    },
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: ({
      itemId,
      isFeatured,
    }: {
      itemId: string;
      isFeatured: boolean;
    }) => updateRestaurantMenuItem(restaurantId, itemId, { isFeatured }),
    onMutate: async ({ itemId, isFeatured }) => {
      await queryClient.cancelQueries({
        queryKey: ["restaurant-menu", restaurantId],
      });
      const previous = queryClient.getQueryData<AdminMenuItem[]>([
        "restaurant-menu",
        restaurantId,
      ]);
      queryClient.setQueryData<AdminMenuItem[]>(
        ["restaurant-menu", restaurantId],
        (current) =>
          (current ?? []).map((item) =>
            item._id === itemId ? { ...item, isFeatured } : item,
          ),
      );
      return { previous };
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.isFeatured
          ? "Marked as featured"
          : "Removed from featured",
      );
    },
    onError: (err: unknown, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["restaurant-menu", restaurantId],
          context.previous,
        );
      }
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      toast.error(msg || "Failed to update featured");
    },
    onSettled: () => {
      invalidateMenu();
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) => deleteCategory(categoryId),
    onSuccess: () => {
      invalidateCategories();
      toast.success("Category deleted");
      setDeleteTarget(null);
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      toast.error(msg || "Failed to delete category");
    },
  });

  useEffect(() => {
    if (!isItemModalOpen) {
      setItemFormReady(false);
      return;
    }
    const id = window.setTimeout(() => setItemFormReady(true), 80);
    return () => window.clearTimeout(id);
  }, [isItemModalOpen, editingItemId]);

  const openCreate = useCallback(() => {
    // Leave the click task before resetting form + mounting the huge dialog.
    afterNextPaint(() => {
      startTransition(() => {
        setEditingItemId(null);
        setForm(emptyForm(restaurantTypeDefaults));
        setIngredientInput("");
        setRelatedItemSearch("");
        setRelatedItemCategories([]);
        setCommissionPercent(DEFAULT_COMMISSION_PERCENT);
        setOriginalPrice(0);
        setOriginalVariantPrices([]);
        setIsItemModalOpen(true);
      });
    });
  }, [restaurantTypeDefaults]);

  const openEdit = useCallback(
    (item: AdminMenuItem) => {
      afterNextPaint(() => {
        startTransition(() => {
          setEditingItemId(item._id);
          const itemTypes =
            item.restaurantTypes && item.restaurantTypes.length > 0
              ? item.restaurantTypes
              : restaurantTypeDefaults.length > 0
                ? restaurantTypeDefaults
                : ["restaurant"];
          const itemMealTypes: MealType[] =
            item.mealTypes && item.mealTypes.length > 0
              ? item.mealTypes
              : item.type
                ? ([item.type] as MealType[])
                : ["lunch"];
          const pct = DEFAULT_COMMISSION_PERCENT;
          const variants = item.variants?.map((v) => ({ ...v })) ?? [];
          const cats = menuItemCategories(item);
          setForm({
            name: item.name,
            description: item.description,
            price: item.price,
            category: cats[0] ?? item.category ?? "",
            categories: cats,
            type: item.type || "lunch",
            mealTypes: [...itemMealTypes],
            preparationTime: item.preparationTime ?? 0,
            packingCharge: item.packingCharge ?? 0,
            variants,
            isVeg: item.isVeg,
            isActive: item.isActive,
            isFeatured: item.isFeatured ?? false,
            pause:
              !item.isActive && item.inactiveUntil
                ? ("today" as const)
                : null,
            inactiveUntil: item.inactiveUntil ?? null,
            availableFrom: item.availableFrom || "",
            availableTo: item.availableTo || "",
            availableSlots: menuItemAvailabilitySlots(item),
            image: item.image || "",
            ingredients: item.ingredients ?? [],
            restaurantTypes: [...itemTypes],
            completeMealItemIds: normalizeRelatedItemIds(
              item.completeMealItemIds,
            ),
          });
          setCommissionPercent(pct);
          setOriginalPrice(originalFromFinal(item.price, pct));
          setOriginalVariantPrices(
            variants.map((v) => originalFromFinal(v.price, pct)),
          );
          setIngredientInput("");
          setRelatedItemSearch("");
          setRelatedItemCategories([]);
          setIsItemModalOpen(true);
        });
      });
    },
    [restaurantTypeDefaults],
  );

  const syncRaisedFromOriginals = (
    nextOriginal: number,
    nextPercent: number,
    nextVariantOriginals: number[],
  ) => {
    setForm((p) => ({
      ...p,
      price: raisedPrice(nextOriginal, nextPercent),
      variants: (p.variants ?? []).map((v, i) => ({
        ...v,
        price: raisedPrice(nextVariantOriginals[i] ?? 0, nextPercent),
      })),
    }));
  };

  const handleCommissionPercentChange = (raw: string) => {
    const next = Number(raw);
    const pct = Number.isFinite(next) ? next : 0;
    setCommissionPercent(pct);
    syncRaisedFromOriginals(originalPrice, pct, originalVariantPrices);
  };

  const handleOriginalPriceChange = (raw: string) => {
    const next = Number(raw);
    const orig = Number.isFinite(next) ? next : 0;
    setOriginalPrice(orig);
    syncRaisedFromOriginals(orig, commissionPercent, originalVariantPrices);
  };

  const handleOriginalVariantPriceChange = (index: number, raw: string) => {
    const next = Number(raw);
    const orig = Number.isFinite(next) ? next : 0;
    const nextVariantOriginals = [...originalVariantPrices];
    nextVariantOriginals[index] = orig;
    setOriginalVariantPrices(nextVariantOriginals);
    syncRaisedFromOriginals(originalPrice, commissionPercent, nextVariantOriginals);
  };

  const addVariantRow = () => {
    setOriginalVariantPrices((prev) => [...prev, 0]);
    setForm((p) => ({
      ...p,
      variants: [
        ...(p.variants ?? []),
        { name: "", price: raisedPrice(0, commissionPercent) },
      ],
    }));
  };

  const removeVariantRow = (index: number) => {
    setOriginalVariantPrices((prev) => prev.filter((_, i) => i !== index));
    setForm((p) => ({
      ...p,
      variants: (p.variants ?? []).filter((_, i) => i !== index),
    }));
  };

  const toggleRestaurantType = (type: RestaurantType) => {
    setForm((prev) => {
      const current = prev.restaurantTypes ?? [];
      if (current.includes(type)) {
        if (current.length <= 1) return prev;
        return {
          ...prev,
          restaurantTypes: current.filter((t) => t !== type),
        };
      }
      return {
        ...prev,
        restaurantTypes: RESTAURANT_TYPES.filter(
          (t) => t === type || current.includes(t),
        ),
      };
    });
  };

  const toggleMealType = (type: MealType) => {
    setForm((prev) => {
      const current = prev.mealTypes ?? [];
      if (current.includes(type)) {
        if (current.length <= 1) return prev;
        const nextMealTypes = current.filter((t) => t !== type);
        return {
          ...prev,
          mealTypes: nextMealTypes,
          type: nextMealTypes[0] ?? "lunch",
        };
      }
      const nextMealTypes = (["breakfast", "lunch", "dinner"] as MealType[]).filter(
        (t) => t === type || current.includes(t),
      );
      return {
        ...prev,
        mealTypes: nextMealTypes,
        type: nextMealTypes[0] ?? type,
      };
    });
  };

  const toggleRelatedItem = (itemId: string) => {
    setForm((prev) => {
      const current = prev.completeMealItemIds ?? [];
      if (current.includes(itemId)) {
        return {
          ...prev,
          completeMealItemIds: current.filter((id) => id !== itemId),
        };
      }
      return {
        ...prev,
        completeMealItemIds: [...current, itemId],
      };
    });
  };

  const handleItemImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingImage(true);
      const url = await uploadMenuImage(file, "menu-items");
      setForm((prev) => ({ ...prev, image: url }));
      toast.success("Image uploaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploadingImage(false);
      event.target.value = "";
    }
  };

  const handleCategoryImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    target: "new" | "edit" = "new",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const setUploading =
      target === "edit"
        ? setIsUploadingEditingCategoryImage
        : setIsUploadingCategoryImage;
    const setImage =
      target === "edit" ? setEditingCategoryImage : setNewCategoryImage;
    try {
      setUploading(true);
      const url = await uploadMenuImage(file, "categories");
      setImage(url);
      toast.success("Category image uploaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const addIngredient = () => {
    const trimmed = ingredientInput.trim();
    if (!trimmed) return;
    setForm((prev) => {
      const current = prev.ingredients ?? [];
      if (current.includes(trimmed)) return prev;
      return { ...prev, ingredients: [...current, trimmed] };
    });
    setIngredientInput("");
  };

  const handleSaveItem = async () => {
    const error = validateForm(form);
    if (error) {
      toast.error(error);
      return;
    }
    const categories = (form.categories ?? [])
      .map((c) => c.trim())
      .filter(Boolean);
    const payload: AdminMenuItemInput = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      category: categories[0] ?? form.category.trim(),
      categories,
      type: (form.mealTypes?.[0] as MealType | undefined) ?? form.type ?? "lunch",
      mealTypes: form.mealTypes ?? [form.type ?? "lunch"],
      variants: (form.variants ?? []).filter((v) => v.name.trim()),
      ingredients: form.ingredients ?? [],
      image: form.image || undefined,
      restaurantTypes: form.restaurantTypes ?? ["restaurant"],
      completeMealItemIds: form.completeMealItemIds ?? [],
      ...(form.pause === "today"
        ? { pause: "today" as const, isActive: false }
        : {
            isActive: form.isActive,
            inactiveUntil: null,
            pause: null,
          }),
      availableSlots: (form.availableSlots ?? [])
        .map((s) => ({
          from: (s.from ?? "").trim(),
          to: (s.to ?? "").trim(),
        }))
        .filter((s) => s.from && s.to),
      availableFrom: (() => {
        const slots = (form.availableSlots ?? [])
          .map((s) => ({
            from: (s.from ?? "").trim(),
            to: (s.to ?? "").trim(),
          }))
          .filter((s) => s.from && s.to);
        return slots[0]?.from ?? "";
      })(),
      availableTo: (() => {
        const slots = (form.availableSlots ?? [])
          .map((s) => ({
            from: (s.from ?? "").trim(),
            to: (s.to ?? "").trim(),
          }))
          .filter((s) => s.from && s.to);
        return slots[0]?.to ?? "";
      })(),
    };
    try {
      setIsSaving(true);
      if (editingItemId) {
        await updateRestaurantMenuItem(restaurantId, editingItemId, payload);
        toast.success("Menu item updated");
      } else {
        await createRestaurantMenuItem(restaurantId, payload);
        toast.success("Menu item added");
      }
      invalidateMenu();
      setIsItemModalOpen(false);
      setEditingItemId(null);
      setRelatedItemSearch("");
      setRelatedItemCategories([]);
      setForm(emptyForm(restaurantTypeDefaults));
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      toast.error(msg || "Failed to save menu item");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("Category name is required");
      return;
    }
    if (isSavingCategory) return;
    try {
      setIsSavingCategory(true);
      await createCategoryForRestaurant(restaurantId, {
        name,
        image: newCategoryImage || undefined,
        parent: newCategoryParentId.trim() || null,
      });
      toast.success("Category created");
      setNewCategoryName("");
      setNewCategoryImage("");
      setNewCategoryParentId("");
      setNewCategoryParentLabel("");
      invalidateCategories();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      toast.error(msg || "Failed to create category");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategoryId) return;
    const name = editingCategoryName.trim();
    if (!name) {
      toast.error("Category name is required");
      return;
    }
    if (isSavingCategory) return;
    try {
      setIsSavingCategory(true);
      const payload: {
        name: string;
        parent: string | null;
        image?: string;
      } = {
        name,
        parent: editingCategoryParentId.trim() || null,
      };
      // Only send image when uploaded/cleared — avoid writing a presigned display URL
      // back into Mongo (would break customer-api static/presign resolution).
      if (editingCategoryImage !== editingCategoryImageBaseline) {
        payload.image = editingCategoryImage || "";
      }
      await updateCategory(editingCategoryId, payload);
      toast.success("Category updated");
      setEditingCategoryId(null);
      setEditingCategoryName("");
      setEditingCategoryImage("");
      setEditingCategoryImageBaseline("");
      setEditingCategoryParentId("");
      setEditingCategoryParentLabel("");
      invalidateCategories();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      toast.error(msg || "Failed to update category");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const startEditCategory = (cat: AdminCategory) => {
    setEditingCategoryId(cat._id);
    setEditingCategoryName(cat.name);
    const image = cat.image || "";
    setEditingCategoryImage(image);
    setEditingCategoryImageBaseline(image);
    const pid = categoryParentId(cat) ?? "";
    setEditingCategoryParentId(pid);
    setEditingCategoryParentLabel(categoryParentName(cat) ?? "");
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName("");
    setEditingCategoryImage("");
    setEditingCategoryImageBaseline("");
    setEditingCategoryParentId("");
    setEditingCategoryParentLabel("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Menu items</h2>
          <p className="text-white/40 text-sm">
            Add and manage dishes for this restaurant (same fields as the owner
            menu).
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/10 text-white hover:bg-white/5"
            onClick={openImportModal}
          >
            <Import size={16} className="mr-2" />
            Import menu
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-white/10 text-white hover:bg-white/5"
            onClick={() => setIsCategoryModalOpen(true)}
          >
            <Tag size={16} className="mr-2" />
            Categories
          </Button>
          <Button
            type="button"
            className="bg-[#98E32F] text-[#013644] hover:bg-[#86c926] font-bold"
            onClick={openCreate}
          >
            <Plus size={16} className="mr-2" />
            Add menu item
          </Button>
        </div>
      </div>

      <MenuSearchInput onSearch={setSearch} />

      {isMenuLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-[20px] bg-white/10 animate-pulse"
            />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-white/40">
          <UtensilsCrossed className="mx-auto mb-3 opacity-40" size={32} />
          <p className="font-medium text-white/60">No menu items yet</p>
          <p className="text-sm mt-1">
            Add the first dish for this restaurant.
          </p>
          <Button
            type="button"
            className="mt-4 bg-[#98E32F] text-[#013644] hover:bg-[#86c926] font-bold"
            onClick={openCreate}
          >
            <Plus size={16} className="mr-2" />
            Add menu item
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredItems.map((item) => (
            <CustomerStyleMenuCard
              key={item._id}
              item={item}
              restaurantName={restaurantName}
              offerPrice={offerPriceByItemId.get(item._id) ?? item.offerPrice}
              onEdit={() => openEdit(item)}
              onDelete={() =>
                setDeleteTarget({
                  type: "item",
                  id: item._id,
                  name: item.name,
                })
              }
              onSetAvailability={(next) =>
                toggleActiveMutation.mutate({
                  itemId: item._id,
                  isActive: next.isActive,
                  pause: next.pause,
                })
              }
              isTogglingActive={
                toggleActiveMutation.isPending &&
                toggleActiveMutation.variables?.itemId === item._id
              }
              onToggleFeatured={(next) =>
                toggleFeaturedMutation.mutate({
                  itemId: item._id,
                  isFeatured: next,
                })
              }
              isTogglingFeatured={
                toggleFeaturedMutation.isPending &&
                toggleFeaturedMutation.variables?.itemId === item._id
              }
            />
          ))}
        </div>
      )}

      {/* Add / Edit item dialog */}
      <Dialog
        open={isItemModalOpen}
        onOpenChange={(open) => {
          setIsItemModalOpen(open);
          if (!open) setItemFormReady(false);
        }}
      >
        <DialogContent className="bg-[#002833] border-white/10 text-white max-w-2xl sm:max-w-2xl max-h-[90vh] overflow-y-auto duration-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">
          <DialogHeader>
            <DialogTitle>
              {editingItemId ? "Edit menu item" : "Add menu item"}
            </DialogTitle>
            <DialogDescription className="text-white/40">
              Creates the item under this restaurant&apos;s owner account.
            </DialogDescription>
          </DialogHeader>

          {!itemFormReady ? (
            <div className="flex justify-center py-16 text-white/40">
              <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
            </div>
          ) : (
          <>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                  Item image
                </label>
                {form.image ? (
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, image: "" }))}
                    className="text-[10px] font-bold text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <input
                type="file"
                id="admin-menu-item-image"
                className="hidden"
                accept="image/*"
                onChange={handleItemImageUpload}
              />
              <label
                htmlFor="admin-menu-item-image"
                className="relative block w-full h-48 sm:h-56 border border-dashed border-white/15 rounded-2xl cursor-pointer hover:border-[#98E32F]/50 overflow-hidden bg-white/5"
              >
                {isUploadingImage ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#98E32F]">
                    <Loader2 className="animate-spin" size={28} />
                    <span className="text-xs font-bold">Uploading...</span>
                  </div>
                ) : form.image ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.image}
                      alt="Menu item preview"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-xs font-bold text-white bg-black/60 px-3 py-1.5 rounded-full">
                        Change image
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/30">
                    <ImageIcon size={28} />
                    <span className="text-xs font-bold">Click to upload image</span>
                    <span className="text-[10px] text-white/20">
                      Square photo recommended
                    </span>
                  </div>
                )}
              </label>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                  Name
                </label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="mt-1 bg-white/5 border-white/10 text-white"
                  placeholder="e.g. Malabar Biryani"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                    Categories
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-[10px] font-bold text-[#98E32F]"
                  >
                    Manage
                  </button>
                </div>
                {(form.categories ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(form.categories ?? []).map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() =>
                          setForm((p) => {
                            const next = (p.categories ?? []).filter(
                              (c) => c !== name,
                            );
                            return {
                              ...p,
                              categories: next,
                              category: next[0] ?? "",
                            };
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#98E32F]/15 text-[#98E32F] border border-[#98E32F]/30"
                      >
                        {name}
                        <X size={12} />
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2">
                  <CategorySearchField
                    value=""
                    onChange={(category) => {
                      const name = category.trim();
                      if (!name) return;
                      setForm((p) => {
                        const current = p.categories ?? [];
                        if (current.includes(name)) return p;
                        const next = [...current, name];
                        return {
                          ...p,
                          categories: next,
                          category: next[0] ?? "",
                        };
                      });
                    }}
                    placeholder="Search to add categories..."
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                Description
              </label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                className="mt-1 bg-white/5 border-white/10 text-white min-h-24"
                placeholder="Describe the dish..."
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                  Pricing (with commission)
                </label>
                <p className="text-[10px] text-white/35">
                  Final = original × (1 + %) · rounded ₹
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                    Original (₹) *
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    required
                    value={originalPrice || ""}
                    onChange={(e) => handleOriginalPriceChange(e.target.value)}
                    placeholder="Partner price"
                    className="mt-1 bg-black/20 border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                    Commission %
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={commissionPercent}
                    onChange={(e) =>
                      handleCommissionPercentChange(e.target.value)
                    }
                    className="mt-1 bg-black/20 border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                    Final (₹)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    readOnly
                    value={form.price || ""}
                    placeholder="—"
                    className="mt-1 bg-[#98E32F]/10 border-[#98E32F]/30 text-[#98E32F] font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                  Prep time (mins)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={form.preparationTime || ""}
                  placeholder="e.g. 20"
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      preparationTime: e.target.value === "" ? 0 : Number(e.target.value),
                    }))
                  }
                  className="mt-1 bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                  Packing charge
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.packingCharge || ""}
                  placeholder="e.g. 5"
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      packingCharge: e.target.value === "" ? 0 : Number(e.target.value),
                    }))
                  }
                  className="mt-1 bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                    Availability schedules
                  </label>
                  <p className="text-[10px] text-white/40 mt-1">
                    Empty = all day (IST). Add morning + evening, etc. Overnight
                    ranges supported (e.g. 22:00 → 02:00).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-white shrink-0"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      availableSlots: [
                        ...(p.availableSlots ?? []),
                        { from: "17:00", to: "21:00" },
                      ],
                    }))
                  }
                >
                  <Plus size={14} className="mr-1" />
                  Add
                </Button>
              </div>
              {(form.availableSlots ?? []).length === 0 ? (
                <p className="text-[11px] text-white/35">
                  No schedules — available all day.
                </p>
              ) : (
                (form.availableSlots ?? []).map((slot, index) => (
                  <div
                    key={`slot-${index}`}
                    className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end"
                  >
                    <div>
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                        From
                      </label>
                      <Input
                        type="time"
                        value={slot.from || ""}
                        onChange={(e) =>
                          setForm((p) => {
                            const next = [...(p.availableSlots ?? [])];
                            next[index] = {
                              ...next[index],
                              from: e.target.value,
                            };
                            return { ...p, availableSlots: next };
                          })
                        }
                        className="mt-1 bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                        To
                      </label>
                      <Input
                        type="time"
                        value={slot.to || ""}
                        onChange={(e) =>
                          setForm((p) => {
                            const next = [...(p.availableSlots ?? [])];
                            next[index] = {
                              ...next[index],
                              to: e.target.value,
                            };
                            return { ...p, availableSlots: next };
                          })
                        }
                        className="mt-1 bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="border-white/10 text-white/70 h-10 w-10"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          availableSlots: (p.availableSlots ?? []).filter(
                            (_, i) => i !== index,
                          ),
                        }))
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                  Variants
                </label>
                <button
                  type="button"
                  className="text-[10px] font-bold text-[#98E32F]"
                  onClick={addVariantRow}
                >
                  + Add variant
                </button>
              </div>
              {(form.variants ?? []).length > 0 && (
                <div className="grid grid-cols-[1fr_5.5rem_5.5rem_2rem] gap-2 px-0.5">
                  <span className="text-[9px] font-bold text-white/30 uppercase">
                    Name
                  </span>
                  <span className="text-[9px] font-bold text-white/30 uppercase">
                    Original
                  </span>
                  <span className="text-[9px] font-bold text-white/30 uppercase">
                    Final
                  </span>
                  <span />
                </div>
              )}
              {(form.variants ?? []).map((variant, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_5.5rem_5.5rem_2rem] gap-2 items-center"
                >
                  <Input
                    value={variant.name}
                    placeholder="Size"
                    onChange={(e) =>
                      setForm((p) => {
                        const variants = [...(p.variants ?? [])];
                        variants[index] = {
                          ...variants[index],
                          name: e.target.value,
                        };
                        return { ...p, variants };
                      })
                    }
                    className="bg-black/20 border-white/10 text-white"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    value={originalVariantPrices[index] || ""}
                    placeholder="Orig"
                    onChange={(e) =>
                      handleOriginalVariantPriceChange(index, e.target.value)
                    }
                    className="bg-black/20 border-white/10 text-white"
                  />
                  <Input
                    type="number"
                    min={0}
                    readOnly
                    value={variant.price || ""}
                    placeholder="—"
                    className="bg-[#98E32F]/10 border-[#98E32F]/30 text-[#98E32F] font-semibold"
                  />
                  <button
                    type="button"
                    className="p-2 text-red-400/70 hover:text-red-400"
                    onClick={() => removeVariantRow(index)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {(form.variants ?? []).length === 0 && (
                <p className="text-[10px] text-white/30 italic">
                  Standard pricing (base price only). Same commission % applies
                  to variants.
                </p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                Ingredients
              </label>
              <div className="mt-1 flex gap-2">
                <Input
                  value={ingredientInput}
                  onChange={(e) => setIngredientInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addIngredient();
                    }
                  }}
                  placeholder="Type and press Enter"
                  className="bg-white/5 border-white/10 text-white"
                />
                <Button
                  type="button"
                  className="bg-[#98E32F] text-[#013644] font-bold"
                  onClick={addIngredient}
                >
                  Add
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(form.ingredients ?? []).map((ing) => (
                  <button
                    key={ing}
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        ingredients: (p.ingredients ?? []).filter((x) => x !== ing),
                      }))
                    }
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/70"
                  >
                    {ing}
                    <X size={10} />
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">
                  Related items
                </label>
                <p className="text-[11px] text-white/45 mt-1">
                  Pick other dishes from this restaurant to suggest as “complete
                  your meal” in the customer cart.
                </p>
              </div>

              {selectedRelatedItems.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedRelatedItems.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => toggleRelatedItem(item._id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#98E32F]/15 border border-[#98E32F]/40 text-[11px] text-[#98E32F] font-semibold"
                    >
                      <span className="truncate max-w-[140px]">{item.name}</span>
                      <X size={12} />
                    </button>
                  ))}
                </div>
              )}

              {relatedItemCategoryOptions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                      Filter by categories
                    </label>
                    {relatedItemCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setRelatedItemCategories([])}
                        className="text-[10px] font-bold text-white/45 hover:text-white"
                      >
                        Clear ({relatedItemCategories.length})
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                    {relatedItemCategoryOptions.map((category) => {
                      const selected = relatedItemCategories.includes(category);
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => toggleRelatedItemCategory(category)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors truncate max-w-[180px] ${
                            selected
                              ? "bg-[#98E32F] text-[#013644] border-[#98E32F]"
                              : "bg-white/5 text-white/55 border-white/10 hover:text-white hover:border-white/20"
                          }`}
                          title={category}
                        >
                          {category}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-white/35">
                    {relatedItemCategories.length === 0
                      ? "Showing all categories. Select one or more to narrow the list."
                      : `Showing items in ${relatedItemCategories.length} selected categor${
                          relatedItemCategories.length === 1 ? "y" : "ies"
                        }.`}
                  </p>
                </div>
              )}

              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                  size={14}
                />
                <Input
                  value={relatedItemSearch}
                  onChange={(e) => setRelatedItemSearch(e.target.value)}
                  placeholder="Search this restaurant’s menu..."
                  className="pl-9 bg-white/5 border-white/10 text-white"
                />
              </div>

              {menuItems.length <= 1 && !editingItemId ? (
                <p className="text-[11px] text-white/35 italic">
                  Add more menu items first to choose related dishes.
                </p>
              ) : relatedItemCandidates.length === 0 ? (
                <p className="text-[11px] text-white/35 italic">
                  {relatedItemSearch.trim() || relatedItemCategories.length > 0
                    ? "No matching items."
                    : "No other active items available."}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {relatedItemCandidates.map((item) => {
                    const selected = (form.completeMealItemIds ?? []).includes(
                      item._id,
                    );
                    return (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => toggleRelatedItem(item._id)}
                        className={`text-left rounded-xl border overflow-hidden transition-colors ${
                          selected
                            ? "border-[#98E32F] bg-[#98E32F]/10"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        }`}
                      >
                        <div className="relative h-16 bg-black/20">
                          {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image}
                              alt={item.name}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-white/20">
                              <ImageIcon size={16} />
                            </div>
                          )}
                          {selected && (
                            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#98E32F] text-[#013644] flex items-center justify-center text-[10px] font-black">
                              ✓
                            </div>
                          )}
                        </div>
                        <div className="px-2 py-1.5">
                          <p className="text-[11px] font-semibold text-white truncate">
                            {item.name}
                          </p>
                          <OfferPrice
                            price={item.price}
                            offerPrice={
                              offerPriceByItemId.get(item._id) ?? item.offerPrice
                            }
                            tone="dark"
                            size="sm"
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">
                  Restaurant type
                </label>
                <p className="text-[11px] text-white/45 mt-1">
                  Select where this item should appear (Cafe, Cool Bar, etc.).
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {RESTAURANT_TYPES.map((type) => {
                  const selected = (form.restaurantTypes ?? []).includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleRestaurantType(type)}
                      className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-colors border ${
                        selected
                          ? "bg-[#98E32F] text-[#013644] border-[#98E32F]"
                          : "bg-white/5 text-white/50 border-white/10 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {RESTAURANT_TYPE_LABELS[type]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 pt-1">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2.5 block">
                  Meal type
                </label>
                <p className="text-[11px] text-white/45 mt-1 mb-2.5">
                  Select one or more meal periods.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(["breakfast", "lunch", "dinner"] as MealType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleMealType(t)}
                      className={`py-2.5 px-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-colors ${
                        (form.mealTypes ?? []).includes(t)
                          ? "bg-[#98E32F] text-[#013644]"
                          : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2.5 block">
                    Dietary
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, isVeg: true }))}
                      className={`py-2.5 rounded-xl text-[11px] font-black uppercase transition-colors ${
                        form.isVeg
                          ? "bg-[#98E32F] text-[#013644]"
                          : "bg-white/5 text-white/50 hover:text-white"
                      }`}
                    >
                      Veg
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, isVeg: false }))}
                      className={`py-2.5 rounded-xl text-[11px] font-black uppercase transition-colors ${
                        !form.isVeg
                          ? "bg-[#98E32F] text-[#013644]"
                          : "bg-white/5 text-white/50 hover:text-white"
                      }`}
                    >
                      Non-veg
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2.5 block">
                    Availability
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          isActive: true,
                          pause: null,
                          inactiveUntil: null,
                        }))
                      }
                      className={`py-2.5 rounded-xl text-[11px] font-black uppercase transition-colors ${
                        form.isActive
                          ? "bg-[#98E32F] text-[#013644]"
                          : "bg-white/5 text-white/50 hover:text-white"
                      }`}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          isActive: false,
                          pause: "today",
                        }))
                      }
                      className={`py-2.5 rounded-xl text-[11px] font-black uppercase transition-colors ${
                        !form.isActive && form.pause === "today"
                          ? "bg-[#98E32F] text-[#013644]"
                          : "bg-white/5 text-white/50 hover:text-white"
                      }`}
                    >
                      Off today
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          isActive: false,
                          pause: null,
                          inactiveUntil: null,
                        }))
                      }
                      className={`py-2.5 rounded-xl text-[11px] font-black uppercase transition-colors ${
                        !form.isActive && form.pause !== "today"
                          ? "bg-[#98E32F] text-[#013644]"
                          : "bg-white/5 text-white/50 hover:text-white"
                      }`}
                    >
                      Off
                    </button>
                  </div>
                  {!form.isActive && form.pause === "today" ? (
                    <p className="mt-2 text-[10px] text-white/35 leading-snug">
                      {(form.availableSlots ?? []).some((s) => (s.from ?? "").trim())
                        ? `Auto-activates tomorrow at ${[...(form.availableSlots ?? [])]
                            .map((s) => (s.from ?? "").trim())
                            .filter(Boolean)
                            .sort()[0]} (schedule start).`
                        : "Auto-activates at tomorrow midnight (IST). No schedule set."}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2.5 block">
                    Featured
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({ ...p, isFeatured: true }))
                      }
                      className={`py-2.5 rounded-xl text-[11px] font-black uppercase transition-colors ${
                        form.isFeatured
                          ? "bg-[#98E32F] text-[#013644]"
                          : "bg-white/5 text-white/50 hover:text-white"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({ ...p, isFeatured: false }))
                      }
                      className={`py-2.5 rounded-xl text-[11px] font-black uppercase transition-colors ${
                        !form.isFeatured
                          ? "bg-[#98E32F] text-[#013644]"
                          : "bg-white/5 text-white/50 hover:text-white"
                      }`}
                    >
                      No
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-white/35 leading-snug">
                    Needs at least 4 featured items to show on the restaurant
                    menu.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-white/10 text-white"
              onClick={() => setIsItemModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#98E32F] text-[#013644] font-bold"
              disabled={isSaving || isUploadingImage}
              onClick={handleSaveItem}
            >
              {isSaving ? (
                <Loader2 className="animate-spin" size={18} />
              ) : editingItemId ? (
                "Save changes"
              ) : (
                "Add item"
              )}
            </Button>
          </DialogFooter>
          </>
          )}
        </DialogContent>
      </Dialog>

      {/* Import menu dialog */}
      <Dialog
        open={isImportModalOpen}
        onOpenChange={(open) => {
          setIsImportModalOpen(open);
          if (!open) resetImportModal();
        }}
      >
        <DialogContent className="bg-[#002833] border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import menu</DialogTitle>
            <DialogDescription className="text-white/40">
              Copy dishes from another restaurant (e.g. a branch) into{" "}
              {restaurantName || "this restaurant"}. Items are cloned so each
              location can edit independently.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/70">Source restaurant</Label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                  size={16}
                />
                <Input
                  value={importSearch}
                  onChange={(e) => setImportSearch(e.target.value)}
                  placeholder="Search restaurants..."
                  className="pl-10 bg-white/5 border-white/10 text-white"
                />
              </div>
              {selectedSource ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-[#98E32F]/30 bg-[#98E32F]/10 px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">
                      {selectedSource.name}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                      {[selectedSource.address?.city, selectedSource.email]
                        .filter(Boolean)
                        .join(" · ") || "Selected source"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-white/50 hover:text-white"
                    onClick={() => setSelectedSource(null)}
                  >
                    <X size={16} />
                  </Button>
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5">
                  {isImportSearchLoading ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-white/40 text-sm">
                      <Loader2 className="animate-spin" size={16} />
                      Searching...
                    </div>
                  ) : importCandidates.length === 0 ? (
                    <p className="py-6 text-center text-sm text-white/40">
                      No restaurants found
                    </p>
                  ) : (
                    importCandidates.map((r) => (
                      <button
                        key={r._id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors"
                        onClick={() => setSelectedSource(r)}
                      >
                        <p className="font-medium text-white truncate">
                          {r.name}
                        </p>
                        <p className="text-xs text-white/40 truncate">
                          {[r.address?.city, r.email].filter(Boolean).join(" · ")}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedSource && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-white/70">
                    Items to import
                    {!isSourceMenuLoading && (
                      <span className="ml-1 text-white/35 font-normal">
                        ({selectedImportItemIds.size}/{sourceMenuItems.length})
                      </span>
                    )}
                  </Label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-white/50 hover:text-white"
                      onClick={selectAllImportItems}
                      disabled={sourceMenuItems.length === 0}
                    >
                      All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-white/50 hover:text-white"
                      onClick={clearImportItemSelection}
                      disabled={selectedImportItemIds.size === 0}
                    >
                      None
                    </Button>
                  </div>
                </div>

                <div className="max-h-52 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5">
                  {isSourceMenuLoading || isSourceMenuFetching ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-white/40 text-sm">
                      <Loader2 className="animate-spin" size={16} />
                      Loading menu...
                    </div>
                  ) : sourceMenuItems.length === 0 ? (
                    <p className="py-8 text-center text-sm text-white/40">
                      This restaurant has no menu items
                    </p>
                  ) : (
                    sourceMenuItems.map((item) => {
                      const checked = selectedImportItemIds.has(item._id);
                      return (
                        <label
                          key={item._id}
                          className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleImportItem(item._id)}
                            className="mt-1 accent-[#98E32F]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-white truncate">
                              {item.name}
                            </span>
                            <span className="block text-xs text-white/40 truncate">
                              {menuItemCategories(item).join(", ") ||
                                "Uncategorized"}{" "}
                              · ₹{item.price}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipExistingNames}
                    onChange={(e) => setSkipExistingNames(e.target.checked)}
                    className="mt-0.5 accent-[#98E32F]"
                  />
                  <span className="text-sm text-white/70">
                    Skip items that already exist here (same name)
                  </span>
                </label>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5"
              onClick={() => setIsImportModalOpen(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#98E32F] text-[#013644] hover:bg-[#86c926] font-bold"
              onClick={handleImportMenu}
              disabled={
                isImporting ||
                !selectedSource ||
                selectedImportItemIds.size === 0
              }
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={16} />
                  Importing...
                </>
              ) : (
                <>
                  <Import size={16} className="mr-2" />
                  Import {selectedImportItemIds.size || ""} item
                  {selectedImportItemIds.size === 1 ? "" : "s"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Categories dialog */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="bg-[#002833] border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage categories</DialogTitle>
            <DialogDescription className="text-white/40">
              Categories are shared across restaurants. New ones are owned by
              this restaurant&apos;s owner.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                New category
              </p>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name"
                className="bg-black/20 border-white/10 text-white"
              />
              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                  Parent category
                </label>
                <CategorySearchField
                  valueKey="_id"
                  value={newCategoryParentId}
                  displayValue={newCategoryParentLabel}
                  allowRoot
                  rootLabel="No Parent (Root Category)"
                  placeholder="Search parent category..."
                  onChange={(id, cat) => {
                    setNewCategoryParentId(id);
                    setNewCategoryParentLabel(cat?.name ?? "");
                  }}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                    Category image
                  </label>
                  {newCategoryImage ? (
                    <button
                      type="button"
                      onClick={() => setNewCategoryImage("")}
                      className="text-[10px] font-bold text-red-400"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <input
                  type="file"
                  id="admin-category-image"
                  className="hidden"
                  accept="image/*"
                  onChange={handleCategoryImageUpload}
                />
                <label
                  htmlFor="admin-category-image"
                  className="relative block w-full h-36 border border-dashed border-white/15 rounded-xl cursor-pointer hover:border-[#98E32F]/50 overflow-hidden bg-black/20"
                >
                  {isUploadingCategoryImage ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#98E32F]">
                      <Loader2 className="animate-spin" size={22} />
                      <span className="text-xs font-bold">Uploading...</span>
                    </div>
                  ) : newCategoryImage ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={newCategoryImage}
                        alt="Category preview"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-xs font-bold text-white bg-black/60 px-3 py-1.5 rounded-full">
                          Change image
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-white/30">
                      <ImageIcon size={22} />
                      <span className="text-xs font-bold">Optional image</span>
                    </div>
                  )}
                </label>
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full bg-[#98E32F] text-[#013644] font-bold"
                disabled={isSavingCategory}
                onClick={handleCreateCategory}
              >
                {isSavingCategory ? "Saving..." : "Create category"}
              </Button>
            </div>

            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                size={14}
              />
              <Input
                value={categoryListSearch}
                onChange={(e) => setCategoryListSearch(e.target.value)}
                placeholder="Search categories..."
                className="pl-9 bg-black/20 border-white/10 text-white"
              />
            </div>

            {isCategoriesLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-[#98E32F]" />
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {categoryTreeRows.length === 0 && (
                  <p className="text-sm text-white/40 text-center py-4">
                    {debouncedCategoryListSearch
                      ? `No categories match “${debouncedCategoryListSearch}”`
                      : "Type to search, or create a category above."}
                  </p>
                )}
                {categoryTreeRows.map(({ cat, level }) => (
                  <div
                    key={cat._id}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                    style={{ marginLeft: Math.min(level, 4) * 16 }}
                  >
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-white/5 shrink-0">
                      {cat.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20 text-xs font-bold">
                          {cat.name[0]?.toUpperCase() || "?"}
                        </div>
                      )}
                    </div>
                    {editingCategoryId === cat._id ? (
                      <div className="flex-1 space-y-2 min-w-0">
                        <Input
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          className="bg-white/5 border-white/10 text-white h-8"
                        />
                        <CategorySearchField
                          valueKey="_id"
                          value={editingCategoryParentId}
                          displayValue={editingCategoryParentLabel}
                          allowRoot
                          rootLabel="No Parent (Root Category)"
                          excludeId={cat._id}
                          placeholder="Search parent..."
                          onChange={(id, selected) => {
                            setEditingCategoryParentId(id);
                            setEditingCategoryParentLabel(selected?.name ?? "");
                          }}
                        />
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                              Category image
                            </label>
                            {editingCategoryImage ? (
                              <button
                                type="button"
                                onClick={() => setEditingCategoryImage("")}
                                className="text-[10px] font-bold text-red-400"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                          <input
                            type="file"
                            id={`admin-edit-category-image-${cat._id}`}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) =>
                              handleCategoryImageUpload(e, "edit")
                            }
                          />
                          <label
                            htmlFor={`admin-edit-category-image-${cat._id}`}
                            className="relative block w-full h-28 border border-dashed border-white/15 rounded-xl cursor-pointer hover:border-[#98E32F]/50 overflow-hidden bg-black/20"
                          >
                            {isUploadingEditingCategoryImage ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#98E32F]">
                                <Loader2 className="animate-spin" size={20} />
                                <span className="text-xs font-bold">
                                  Uploading...
                                </span>
                              </div>
                            ) : editingCategoryImage ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={editingCategoryImage}
                                  alt="Category preview"
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-xs font-bold text-white bg-black/60 px-3 py-1.5 rounded-full">
                                    Change image
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-white/30">
                                <ImageIcon size={20} />
                                <span className="text-xs font-bold">
                                  Add image
                                </span>
                              </div>
                            )}
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-[#98E32F] text-[#013644] font-bold h-8"
                            disabled={
                              isSavingCategory || isUploadingEditingCategoryImage
                            }
                            onClick={handleUpdateCategory}
                          >
                            {isSavingCategory ? "Saving..." : "Save"}
                          </Button>
                          <button
                            type="button"
                            className="text-white/40 px-2"
                            onClick={cancelEditCategory}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {level > 0 && (
                              <span className="text-white/25 text-xs shrink-0">└</span>
                            )}
                            <span className="text-sm font-medium truncate">
                              {cat.name}
                            </span>
                          </div>
                          {categoryParentName(cat) ? (
                            <p className="text-[10px] text-white/35 truncate mt-0.5">
                              under {categoryParentName(cat)}
                            </p>
                          ) : (
                            <p className="text-[10px] text-white/25 mt-0.5">
                              Root category
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5"
                          onClick={() => startEditCategory(cat)}
                        >
                          <Edit2 size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => {
                            const linkedMenuItemCount = menuItems.filter(
                              (item) => {
                                const tags = menuItemCategories(item);
                                return (
                                  tags.includes(cat.name) ||
                                  tags.includes(cat._id) ||
                                  item.category === cat.name ||
                                  item.category === cat._id
                                );
                              },
                            ).length;
                            setDeleteTarget({
                              type: "category",
                              id: cat._id,
                              name: cat.name,
                              linkedMenuItemCount,
                            });
                          }}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="bg-[#002833] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              Delete {deleteTarget?.type === "category" ? "category" : "menu item"}?
            </DialogTitle>
            <DialogDescription className="text-white/40">
              This will permanently remove{" "}
              <span className="text-white font-medium">{deleteTarget?.name}</span>.
            </DialogDescription>
            {deleteTarget?.type === "category" &&
            (deleteTarget.linkedMenuItemCount ?? 0) > 0 ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                {deleteTarget.linkedMenuItemCount} menu item
                {deleteTarget.linkedMenuItemCount === 1 ? " is" : "s are"} linked
                to this category. Delete will be blocked until those items are moved
                to another category.
              </div>
            ) : null}
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-white/10 text-white"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-red-500 hover:bg-red-600 text-white font-bold"
              disabled={
                deleteItemMutation.isPending || deleteCategoryMutation.isPending
              }
              onClick={() => {
                if (!deleteTarget) return;
                if (deleteTarget.type === "item") {
                  deleteItemMutation.mutate(deleteTarget.id);
                } else {
                  deleteCategoryMutation.mutate(deleteTarget.id);
                }
              }}
            >
              {deleteItemMutation.isPending || deleteCategoryMutation.isPending ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
