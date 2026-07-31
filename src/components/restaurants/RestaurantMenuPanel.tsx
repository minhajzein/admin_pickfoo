"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Edit2,
  ImageIcon,
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
  type AdminCategory,
  type AdminMenuItem,
  type AdminMenuItemInput,
  type AdminMenuVariant,
  updateCategory,
  updateRestaurantMenuItem,
  uploadMenuImage,
} from "@/lib/api/menu";
import { CustomerStyleMenuCard } from "@/components/restaurants/CustomerStyleMenuCard";
import { CategorySearchField, categoryParentId, categoryParentName } from "@/components/restaurants/CategorySearchField";
import { RESTAURANT_TYPES, type RestaurantType } from "@/types/models";

type MealType = "breakfast" | "lunch" | "dinner";

const DEFAULT_COMMISSION_PERCENT = 12;

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
): AdminMenuItemInput & { variants: AdminMenuVariant[] } => ({
  name: "",
  description: "",
  price: 0,
  category: "",
  type: "lunch",
  mealTypes: ["lunch"],
  preparationTime: 0,
  packingCharge: 0,
  variants: [],
  isVeg: true,
  isActive: true,
  image: "",
  ingredients: [],
  restaurantTypes:
    restaurantTypes.length > 0 ? [...restaurantTypes] : ["restaurant"],
  completeMealItemIds: [],
});

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

function validateForm(form: AdminMenuItemInput): string | null {
  if (!form.name.trim() || form.name.trim().length < 2) {
    return "Item name must be at least 2 characters";
  }
  if (!form.description.trim() || form.description.trim().length < 10) {
    return "Description must be at least 10 characters";
  }
  if (!form.category.trim()) return "Category is required";
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
  return null;
}

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
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [form, setForm] = useState(() => emptyForm(restaurantTypeDefaults));
  const [ingredientInput, setIngredientInput] = useState("");
  const [relatedItemSearch, setRelatedItemSearch] = useState("");
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

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedCategoryListSearch(categoryListSearch.trim());
    }, 250);
    return () => window.clearTimeout(t);
  }, [categoryListSearch]);

  const { data: menuItems = [], isLoading: isMenuLoading } = useQuery({
    queryKey: ["restaurant-menu", restaurantId],
    queryFn: () => fetchRestaurantMenu(restaurantId),
  });

  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ["menu-categories", debouncedCategoryListSearch],
    queryFn: () =>
      fetchCategories({
        search: debouncedCategoryListSearch || undefined,
        limit: debouncedCategoryListSearch ? 50 : 200,
      }),
    enabled: isCategoryModalOpen,
  });

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
    return menuItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q),
    );
  }, [menuItems, search]);

  const relatedItemCandidates = useMemo(() => {
    const q = relatedItemSearch.trim().toLowerCase();
    return menuItems.filter((item) => {
      if (editingItemId && item._id === editingItemId) return false;
      if (!item.isActive) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [menuItems, editingItemId, relatedItemSearch]);

  const selectedRelatedItems = useMemo(() => {
    const ids = new Set(form.completeMealItemIds ?? []);
    return menuItems.filter((item) => ids.has(item._id));
  }, [menuItems, form.completeMealItemIds]);

  const invalidateMenu = () => {
    queryClient.invalidateQueries({ queryKey: ["restaurant-menu", restaurantId] });
  };
  const invalidateCategories = () => {
    queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
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

  const openCreate = () => {
    setEditingItemId(null);
    setForm(emptyForm(restaurantTypeDefaults));
    setIngredientInput("");
    setRelatedItemSearch("");
    setCommissionPercent(DEFAULT_COMMISSION_PERCENT);
    setOriginalPrice(0);
    setOriginalVariantPrices([]);
    setIsItemModalOpen(true);
  };

  const openEdit = (item: AdminMenuItem) => {
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
    setForm({
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      type: item.type || "lunch",
      mealTypes: [...itemMealTypes],
      preparationTime: item.preparationTime ?? 0,
      packingCharge: item.packingCharge ?? 0,
      variants,
      isVeg: item.isVeg,
      isActive: item.isActive,
      image: item.image || "",
      ingredients: item.ingredients ?? [],
      restaurantTypes: [...itemTypes],
      completeMealItemIds: normalizeRelatedItemIds(item.completeMealItemIds),
    });
    setCommissionPercent(pct);
    setOriginalPrice(originalFromFinal(item.price, pct));
    setOriginalVariantPrices(
      variants.map((v) => originalFromFinal(v.price, pct)),
    );
    setIngredientInput("");
    setRelatedItemSearch("");
    setIsItemModalOpen(true);
  };

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
    const payload: AdminMenuItemInput = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      type: (form.mealTypes?.[0] as MealType | undefined) ?? form.type ?? "lunch",
      mealTypes: form.mealTypes ?? [form.type ?? "lunch"],
      variants: (form.variants ?? []).filter((v) => v.name.trim()),
      ingredients: form.ingredients ?? [],
      image: form.image || undefined,
      restaurantTypes: form.restaurantTypes ?? ["restaurant"],
      completeMealItemIds: form.completeMealItemIds ?? [],
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

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
          size={16}
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          className="pl-10 bg-white/5 border-white/10 text-white"
        />
      </div>

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
              onEdit={() => openEdit(item)}
              onDelete={() =>
                setDeleteTarget({
                  type: "item",
                  id: item._id,
                  name: item.name,
                })
              }
            />
          ))}
        </div>
      )}

      {/* Add / Edit item dialog */}
      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        <DialogContent className="bg-[#002833] border-white/10 text-white max-w-2xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItemId ? "Edit menu item" : "Add menu item"}
            </DialogTitle>
            <DialogDescription className="text-white/40">
              Creates the item under this restaurant&apos;s owner account.
            </DialogDescription>
          </DialogHeader>

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
                    Category
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-[10px] font-bold text-[#98E32F]"
                  >
                    Manage
                  </button>
                </div>
                <CategorySearchField
                  value={form.category}
                  onChange={(category) =>
                    setForm((p) => ({ ...p, category }))
                  }
                  placeholder="Search categories..."
                />
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
                  {relatedItemSearch.trim()
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
                          <p className="text-[10px] text-white/40 truncate">
                            ₹{Math.round(item.price)}
                          </p>
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
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, isActive: true }))}
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
                      onClick={() => setForm((p) => ({ ...p, isActive: false }))}
                      className={`py-2.5 rounded-xl text-[11px] font-black uppercase transition-colors ${
                        !form.isActive
                          ? "bg-[#98E32F] text-[#013644]"
                          : "bg-white/5 text-white/50 hover:text-white"
                      }`}
                    >
                      Off
                    </button>
                  </div>
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
                              (item) =>
                                item.category === cat.name ||
                                item.category === cat._id
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
