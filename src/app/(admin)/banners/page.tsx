"use client";

import { useMemo, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageIcon, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createBanner,
  deleteBanner,
  fetchBanners,
  searchBannerMenuItems,
  searchBannerRestaurants,
  updateBanner,
  uploadBannerImage,
  type AdminHomeBanner,
  type BannerMenuItemOption,
  type BannerRestaurantOption,
  type HomeBannerLinkType,
} from "@/lib/api/banners";

const linkTypeLabels: Record<HomeBannerLinkType, string> = {
  none: "No link",
  restaurant: "Restaurant",
  dish: "Single dish",
  dishes: "Multiple dishes",
};

const emptyForm = () => ({
  title: "",
  subtitle: "",
  imageStaticUrl: "",
  imagePreview: "",
  linkType: "none" as HomeBannerLinkType,
  restaurantId: "",
  menuItemId: "",
  menuItemIds: [] as string[],
  sortOrder: 0,
  isActive: true,
});

export default function BannersPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const [dishSearch, setDishSearch] = useState("");
  const [restaurantOptions, setRestaurantOptions] = useState<BannerRestaurantOption[]>([]);
  const [dishOptions, setDishOptions] = useState<BannerMenuItemOption[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: fetchBanners,
  });

  const resolveImageUrl = () =>
    form.imageStaticUrl.trim() || form.imagePreview.trim();

  const validateForm = (): string | null => {
    if (!resolveImageUrl()) return "Please upload a banner image first";
    if (form.linkType === "restaurant" && !form.restaurantId) {
      return "Select a restaurant for this link type";
    }
    if (form.linkType === "dish" && !form.menuItemId) {
      return "Select a dish for this link type";
    }
    if (form.linkType === "dishes" && form.menuItemIds.length === 0) {
      return "Select at least one dish for this link type";
    }
    return null;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }
    saveMutation.mutate();
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const imageStaticUrl = resolveImageUrl();
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        imageStaticUrl,
        linkType: form.linkType,
        restaurantId:
          form.linkType === "restaurant" ||
          form.linkType === "dish" ||
          form.linkType === "dishes"
            ? form.restaurantId || null
            : null,
        menuItemId: form.linkType === "dish" ? form.menuItemId || null : null,
        menuItemIds: form.linkType === "dishes" ? form.menuItemIds : [],
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };
      if (editingId) {
        return updateBanner(editingId, payload);
      }
      return createBanner(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      toast.success(editingId ? "Banner updated" : "Banner created");
      resetForm();
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Failed to save banner"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBanner,
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      toast.success("Banner deleted");
      if (editingId === deletedId) resetForm();
    },
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "Failed to delete banner";
      toast.error(message);
    },
  });

  const activeCount = useMemo(
    () => banners.filter((b) => b.isActive).length,
    [banners],
  );

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
    setRestaurantOptions([]);
    setDishOptions([]);
    setRestaurantSearch("");
    setDishSearch("");
  };

  const openCreate = () => {
    setForm(emptyForm());
    setEditingId(null);
    setRestaurantOptions([]);
    setDishOptions([]);
    setRestaurantSearch("");
    setDishSearch("");
    setShowForm(true);
  };

  const apiErrorMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error) && typeof error.response?.data?.message === "string") {
      return error.response.data.message;
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  };

  const loadRestaurants = async () => {
    try {
      const rows = await searchBannerRestaurants(restaurantSearch);
      setRestaurantOptions(rows);
      if (rows.length === 0) {
        toast.message("No restaurants found", {
          description: "Try a different name or check status on the Restaurants page.",
        });
      }
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, "Failed to search restaurants"));
    }
  };

  const loadDishes = async () => {
    try {
      const rows = await searchBannerMenuItems({
        search: dishSearch,
        restaurantId: form.restaurantId || undefined,
      });
      setDishOptions(rows);
      if (rows.length === 0) {
        toast.message("No dishes found", {
          description: "Try another name or pick a restaurant filter first.",
        });
      }
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, "Failed to search dishes"));
    }
  };

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadBannerImage(file);
      setForm((f) => ({
        ...f,
        imageStaticUrl: uploaded.staticUrl,
        imagePreview: uploaded.fileUrl,
      }));
      toast.success("Image uploaded");
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (banner: AdminHomeBanner) => {
    setShowForm(true);
    setEditingId(banner.id);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle,
      imageStaticUrl: banner.imageStaticUrl,
      imagePreview: banner.imageUrl,
      linkType: banner.linkType,
      restaurantId: banner.restaurantId ?? "",
      menuItemId: banner.menuItemId ?? "",
      menuItemIds: banner.menuItemIds ?? [],
      sortOrder: banner.sortOrder,
      isActive: banner.isActive,
    });
  };

  const toggleDishSelection = (id: string) => {
    setForm((f) => {
      const set = new Set(f.menuItemIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, menuItemIds: Array.from(set) };
    });
  };

  const linkSummary = (banner: AdminHomeBanner) => {
    if (banner.linkType === "restaurant") return `Restaurant: ${banner.restaurantId}`;
    if (banner.linkType === "dish") return `Dish: ${banner.menuItemId}`;
    if (banner.linkType === "dishes") return `${banner.menuItemIds.length} dishes`;
    return "—";
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Home banners</h2>
          <p className="text-white/60 text-sm mt-1">
            Manage promo carousel on the customer app home screen. Link to a restaurant or dish(es).
          </p>
        </div>
        {!showForm && (
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Add banner
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#002833] border-white/10">
          <CardContent className="pt-6">
            <p className="text-sm text-white/60">Total banners</p>
            <p className="text-3xl font-bold text-[#98E32F]">{banners.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#002833] border-white/10">
          <CardContent className="pt-6">
            <p className="text-sm text-white/60">Active</p>
            <p className="text-3xl font-bold text-[#98E32F]">{activeCount}</p>
          </CardContent>
        </Card>
      </div>

      {showForm && (
      <Card className="bg-[#002833] border-white/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{editingId ? "Edit banner" : "Create banner"}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={resetForm}>
            Cancel
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title (optional)</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="FLAT ₹100 OFF"
              />
            </div>
            <div className="space-y-2">
              <Label>Subtitle (optional)</Label>
              <Input
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                placeholder="On your first 5 orders"
              />
            </div>
            <div className="space-y-2">
              <Label>Sort order</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Link type</Label>
              <select
                className="w-full h-10 rounded-md bg-[#013644] border border-white/20 px-3 text-sm"
                value={form.linkType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    linkType: e.target.value as HomeBannerLinkType,
                    restaurantId: "",
                    menuItemId: "",
                    menuItemIds: [],
                  }))
                }
              >
                {Object.entries(linkTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Banner image</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                disabled={uploading}
              />
              {uploading && <Loader2 className="h-5 w-5 animate-spin text-[#98E32F]" />}
            </div>
            {form.imagePreview && (
              <img
                src={form.imagePreview}
                alt="Preview"
                className="mt-2 h-32 w-full max-w-md rounded-lg object-cover border border-white/10"
              />
            )}
            {!resolveImageUrl() && (
              <p className="text-xs text-amber-400/90">
                Upload an image before saving — the create button needs a successful upload.
              </p>
            )}
          </div>

          {(form.linkType === "restaurant" ||
            form.linkType === "dish" ||
            form.linkType === "dishes") && (
            <div className="space-y-2 rounded-lg border border-white/10 p-4">
              <Label>Restaurant (optional for dishes filter)</Label>
              <div className="flex gap-2">
                <Input
                  value={restaurantSearch}
                  onChange={(e) => setRestaurantSearch(e.target.value)}
                  placeholder="Search restaurant name"
                />
                <Button type="button" variant="outline" onClick={loadRestaurants}>
                  Search
                </Button>
              </div>
              {restaurantOptions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {restaurantOptions.map((r) => (
                    <Button
                      key={r.id}
                      type="button"
                      size="sm"
                      variant={form.restaurantId === r.id ? "default" : "outline"}
                      onClick={() => setForm((f) => ({ ...f, restaurantId: r.id }))}
                    >
                      {r.name}
                    </Button>
                  ))}
                </div>
              )}
              {form.restaurantId && (
                <p className="text-xs text-white/50">Selected: {form.restaurantId}</p>
              )}
            </div>
          )}

          {form.linkType === "dish" && (
            <div className="space-y-2 rounded-lg border border-white/10 p-4">
              <Label>Select one dish</Label>
              <div className="flex gap-2">
                <Input
                  value={dishSearch}
                  onChange={(e) => setDishSearch(e.target.value)}
                  placeholder="Search dish name"
                />
                <Button type="button" variant="outline" onClick={loadDishes}>
                  Search
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {dishOptions.map((d) => (
                  <Button
                    key={d.id}
                    type="button"
                    size="sm"
                    variant={form.menuItemId === d.id ? "default" : "outline"}
                    onClick={() => setForm((f) => ({ ...f, menuItemId: d.id }))}
                  >
                    {d.name} (₹{d.price})
                  </Button>
                ))}
              </div>
            </div>
          )}

          {form.linkType === "dishes" && (
            <div className="space-y-2 rounded-lg border border-white/10 p-4">
              <Label>Select dishes (multi)</Label>
              <div className="flex gap-2">
                <Input
                  value={dishSearch}
                  onChange={(e) => setDishSearch(e.target.value)}
                  placeholder="Search dish name"
                />
                <Button type="button" variant="outline" onClick={loadDishes}>
                  Search
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {dishOptions.map((d) => (
                  <Button
                    key={d.id}
                    type="button"
                    size="sm"
                    variant={form.menuItemIds.includes(d.id) ? "default" : "outline"}
                    onClick={() => toggleDishSelection(d.id)}
                  >
                    {d.name}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-white/50">
                Selected: {form.menuItemIds.length} dish(es)
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active (visible on customer home)
          </label>

          <div className="flex gap-2">
            <Button type="submit" disabled={saveMutation.isPending || uploading}>
              {saveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingId ? "Update banner" : "Create banner"}
            </Button>
          </div>
          </form>
        </CardContent>
      </Card>
      )}

      <Card className="bg-[#002833] border-white/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            All banners
          </CardTitle>
          {!showForm && (
            <Button onClick={openCreate} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add banner
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
            </div>
          ) : banners.length === 0 ? (
            <p className="text-center text-white/50 py-8 text-sm">
              No banners yet. Click <strong className="text-white/80">Add banner</strong> to create one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preview</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banners.map((banner) => (
                  <TableRow key={banner.id}>
                    <TableCell>
                      <img
                        src={banner.imageUrl}
                        alt=""
                        className="h-14 w-24 rounded object-cover"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {banner.title?.trim() || (
                          <span className="text-white/40 italic">No title</span>
                        )}
                      </div>
                      {banner.subtitle?.trim() ? (
                        <div className="text-xs text-white/50">{banner.subtitle}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{linkTypeLabels[banner.linkType]}</div>
                      <div className="text-white/50">{linkSummary(banner)}</div>
                    </TableCell>
                    <TableCell>{banner.sortOrder}</TableCell>
                    <TableCell>
                      <Badge variant={banner.isActive ? "default" : "outline"}>
                        {banner.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(banner)}
                          aria-label={`Edit ${banner.title?.trim() || "banner"}`}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-400 hover:text-red-300"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                `Delete banner "${banner.title?.trim() || "this banner"}"?`,
                              )
                            ) {
                              deleteMutation.mutate(banner.id);
                            }
                          }}
                          aria-label={`Delete ${banner.title?.trim() || "banner"}`}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
