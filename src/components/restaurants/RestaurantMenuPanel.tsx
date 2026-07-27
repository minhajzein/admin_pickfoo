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

const RESTAURANT_TYPE_LABELS: Record<RestaurantType, string> = {
  restaurant: "Restaurant",
  cafe: "Cafe",
  bakery: "Bakery",
  coolbar: "Cool Bar",
  hotbar: "Hot Bar",
  home_made: "Home Made",
};

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
});

function validateForm(form: AdminMenuItemInput): string | null {
  if (!form.name.trim() || form.name.trim().length < 2) {
    return "Item name must be at least 2 characters";
  }
  if (!form.description.trim() || form.description.trim().length < 10) {
    return "Description must be at least 10 characters";
  }
  if (!form.category.trim()) return "Category is required";
  if (!Number.isFinite(form.price) || form.price < 0) {
    return "Price cannot be negative";
  }
  if (!form.mealTypes || form.mealTypes.length === 0) {
    return "Select at least one meal type";
  }
  if (!form.restaurantTypes || form.restaurantTypes.length === 0) {
    return "Select at least one restaurant type";
  }
  for (const v of form.variants ?? []) {
    if (!v.name.trim()) return "Each variant needs a name";
    if (!Number.isFinite(v.price) || v.price < 0) {
      return "Variant prices cannot be negative";
    }
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
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryParentId, setEditingCategoryParentId] = useState("");
  const [editingCategoryParentLabel, setEditingCategoryParentLabel] =
    useState("");

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "item" | "category";
    id: string;
    name: string;
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
    const itemMealTypes =
      item.mealTypes && item.mealTypes.length > 0
        ? item.mealTypes
        : item.type
          ? [item.type]
          : ["lunch"];
    setForm({
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      type: item.type || "lunch",
      mealTypes: [...itemMealTypes],
      preparationTime: item.preparationTime ?? 0,
      packingCharge: item.packingCharge ?? 0,
      variants: item.variants?.map((v) => ({ ...v })) ?? [],
      isVeg: item.isVeg,
      isActive: item.isActive,
      image: item.image || "",
      ingredients: item.ingredients ?? [],
      restaurantTypes: [...itemTypes],
    });
    setIngredientInput("");
    setIsItemModalOpen(true);
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
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingCategoryImage(true);
      const url = await uploadMenuImage(file, "categories");
      setNewCategoryImage(url);
      toast.success("Category image uploaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploadingCategoryImage(false);
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
    try {
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
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategoryId) return;
    const name = editingCategoryName.trim();
    if (!name) {
      toast.error("Category name is required");
      return;
    }
    try {
      await updateCategory(editingCategoryId, {
        name,
        parent: editingCategoryParentId.trim() || null,
      });
      toast.success("Category updated");
      setEditingCategoryId(null);
      setEditingCategoryName("");
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
    }
  };

  const startEditCategory = (cat: AdminCategory) => {
    setEditingCategoryId(cat._id);
    setEditingCategoryName(cat.name);
    const pid = categoryParentId(cat) ?? "";
    setEditingCategoryParentId(pid);
    setEditingCategoryParentLabel(categoryParentName(cat) ?? "");
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                    Base price
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.price}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        price: Number(e.target.value),
                      }))
                    }
                    className="mt-1 bg-white/5 border-white/10 text-white"
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                  Prep time (mins)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={form.preparationTime}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      preparationTime: Number(e.target.value),
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
                  value={form.packingCharge}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      packingCharge: Number(e.target.value),
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
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      variants: [...(p.variants ?? []), { name: "", price: 0 }],
                    }))
                  }
                >
                  + Add variant
                </button>
              </div>
              {(form.variants ?? []).map((variant, index) => (
                <div key={index} className="flex gap-2">
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
                    value={variant.price}
                    placeholder="Price"
                    onChange={(e) =>
                      setForm((p) => {
                        const variants = [...(p.variants ?? [])];
                        variants[index] = {
                          ...variants[index],
                          price: Number(e.target.value),
                        };
                        return { ...p, variants };
                      })
                    }
                    className="w-28 bg-black/20 border-white/10 text-white"
                  />
                  <button
                    type="button"
                    className="p-2 text-red-400/70 hover:text-red-400"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        variants: (p.variants ?? []).filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {(form.variants ?? []).length === 0 && (
                <p className="text-[10px] text-white/30 italic">
                  Standard pricing (base price only)
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
                onClick={handleCreateCategory}
              >
                Create category
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
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-[#98E32F] text-[#013644] font-bold h-8"
                            onClick={handleUpdateCategory}
                          >
                            Save
                          </Button>
                          <button
                            type="button"
                            className="text-white/40 px-2"
                            onClick={() => {
                              setEditingCategoryId(null);
                              setEditingCategoryParentId("");
                              setEditingCategoryParentLabel("");
                            }}
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
                          className="p-1.5 text-white/40 hover:text-white"
                          onClick={() => startEditCategory(cat)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 text-red-500/50 hover:text-red-500"
                          onClick={() =>
                            setDeleteTarget({
                              type: "category",
                              id: cat._id,
                              name: cat.name,
                            })
                          }
                        >
                          <Trash2 size={14} />
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
