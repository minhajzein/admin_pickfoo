"use client";

import { useEffect, useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  createCoupon,
  deleteCoupon,
  fetchCoupons,
  searchCouponCategories,
  searchCouponMenuItems,
  searchCouponOffers,
  searchCouponRestaurants,
  updateCoupon,
  type AdminCoupon,
  type CouponCategoryOption,
  type CouponKind,
  type CouponMenuItemOption,
  type CouponOfferOption,
  type CouponRestaurantOption,
  type CouponScope,
} from "@/lib/api/coupons";
import { ListPagination } from "@/components/ui/list-pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

type FormState = {
  code: string;
  kind: CouponKind;
  title: string;
  description: string;
  offerId: string;
  offerTitle: string;
  scope: CouponScope;
  restaurantIds: string[];
  menuItemIds: string[];
  categoryNames: string[];
  usageLimit: number;
  usagePerUser: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  code: "",
  kind: "coupon",
  title: "",
  description: "",
  offerId: "",
  offerTitle: "",
  scope: "all",
  restaurantIds: [],
  menuItemIds: [],
  categoryNames: [],
  usageLimit: 0,
  usagePerUser: 0,
  startsAt: "",
  endsAt: "",
  isActive: true,
});

function formFromRow(row: AdminCoupon): FormState {
  return {
    ...emptyForm(),
    code: row.code,
    kind: row.kind,
    title: row.title,
    description: row.description,
    offerId: row.offerId,
    offerTitle: row.offerTitle || "",
    scope: row.scope || "all",
    restaurantIds: row.restaurantIds || [],
    menuItemIds: row.menuItemIds || [],
    categoryNames: row.categoryNames || [],
    usageLimit: row.usageLimit,
    usagePerUser: row.usagePerUser,
    startsAt: row.startsAt ? row.startsAt.slice(0, 16) : "",
    endsAt: row.endsAt ? row.endsAt.slice(0, 16) : "",
    isActive: row.isActive,
  };
}

function scopeLabel(scope: CouponScope | undefined) {
  if (scope === "restaurants") return "Restaurants";
  if (scope === "items") return "Dishes";
  if (scope === "categories") return "Categories";
  return "All";
}

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [kindFilter, setKindFilter] = useState<"" | CouponKind>("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [offerSearch, setOfferSearch] = useState("");
  const [offerOptions, setOfferOptions] = useState<CouponOfferOption[]>([]);
  const [searchingOffers, setSearchingOffers] = useState(false);
  const [restoSearch, setRestoSearch] = useState("");
  const [restoOptions, setRestoOptions] = useState<CouponRestaurantOption[]>([]);
  const [dishSearch, setDishSearch] = useState("");
  const [dishFilterRestaurantId, setDishFilterRestaurantId] = useState("");
  const [dishOptions, setDishOptions] = useState<CouponMenuItemOption[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<CouponCategoryOption[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-coupons", page, kindFilter],
    queryFn: () =>
      fetchCoupons({
        page,
        limit: DEFAULT_PAGE_SIZE,
        kind: kindFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.code.trim()) throw new Error("Code is required");
      if (!form.title.trim()) throw new Error("Title is required");
      if (!form.offerId) throw new Error("Select a linked offer");
      if (form.scope === "restaurants" && form.restaurantIds.length === 0) {
        throw new Error("Select at least one restaurant");
      }
      if (form.scope === "items" && form.menuItemIds.length === 0) {
        throw new Error("Select at least one dish");
      }
      if (form.scope === "categories" && form.categoryNames.length === 0) {
        throw new Error("Select at least one category");
      }
      const payload = {
        code: form.code.trim().toUpperCase(),
        kind: form.kind,
        title: form.title.trim(),
        description: form.description.trim(),
        offerId: form.offerId,
        scope: form.scope,
        restaurantIds: form.scope === "restaurants" ? form.restaurantIds : [],
        menuItemIds: form.scope === "items" ? form.menuItemIds : [],
        categoryNames: form.scope === "categories" ? form.categoryNames : [],
        isActive: form.isActive,
        usageLimit: form.usageLimit,
        usagePerUser: form.usagePerUser,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      };
      if (editingId) return updateCoupon(editingId, payload);
      return createCoupon(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "Updated" : "Created");
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm());
    },
    onError: (e: Error) => toast.error(e.message || "Save failed"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCoupon,
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (e: Error) => toast.error(e.message || "Delete failed"),
  });

  async function runOfferSearch(term = offerSearch) {
    setSearchingOffers(true);
    try {
      setOfferOptions(await searchCouponOffers(term));
    } finally {
      setSearchingOffers(false);
    }
  }

  async function runRestoSearch() {
    try {
      setRestoOptions(await searchCouponRestaurants(restoSearch));
    } catch {
      toast.error("Restaurant search failed");
    }
  }

  async function runDishSearch() {
    try {
      setDishOptions(
        await searchCouponMenuItems({
          search: dishSearch,
          restaurantId: dishFilterRestaurantId || form.restaurantIds[0],
        }),
      );
    } catch {
      toast.error("Dish search failed");
    }
  }

  async function runCategorySearch() {
    try {
      setCategoryOptions(await searchCouponCategories(categorySearch));
    } catch {
      toast.error("Category search failed");
    }
  }

  useEffect(() => {
    if (!open) return;
    void runOfferSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setOfferSearch("");
    setOfferOptions([]);
    setRestoSearch("");
    setRestoOptions([]);
    setDishSearch("");
    setDishOptions([]);
    setDishFilterRestaurantId("");
    setCategorySearch("");
    setCategoryOptions([]);
    setOpen(true);
  }

  function openEdit(row: AdminCoupon) {
    setEditingId(row.id);
    setForm(formFromRow(row));
    setOfferSearch("");
    setOfferOptions(
      row.offerId
        ? [
            {
              id: row.offerId,
              title: row.offerTitle || row.offerId,
              subtitle: "",
              type: "",
              status: "",
            },
          ]
        : [],
    );
    setRestoOptions([]);
    setDishOptions([]);
    setCategoryOptions(
      (row.categoryNames || []).map((name) => ({ id: name, name, image: "" })),
    );
    setOpen(true);
  }

  const dialogTitle = useMemo(
    () => (editingId ? "Edit code" : "Create coupon / voucher"),
    [editingId],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Coupons & vouchers</h1>
          <p className="text-sm text-white/60">
            Link a code to a customer offer, and optionally limit it to restaurants, dishes, or
            categories.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-[#98E32F] text-[#013644]">
          <Plus className="mr-2 h-4 w-4" /> New code
        </Button>
      </div>

      <div className="flex gap-2">
        {(["", "coupon", "voucher"] as const).map((k) => (
          <Button
            key={k || "all"}
            size="sm"
            variant={kindFilter === k ? "default" : "outline"}
            onClick={() => {
              setKindFilter(k);
              setPage(1);
            }}
          >
            {k === "" ? "All" : k === "coupon" ? "Coupons" : "Vouchers"}
          </Button>
        ))}
      </div>

      <Card className="border-white/10 bg-[#013644]/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Ticket className="h-5 w-5 text-[#98E32F]" /> Codes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#98E32F]" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Offer</TableHead>
                    <TableHead>Applies to</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono font-semibold text-[#98E32F]">
                        {row.code}
                      </TableCell>
                      <TableCell className="capitalize text-white/80">{row.kind}</TableCell>
                      <TableCell className="text-white">{row.title}</TableCell>
                      <TableCell className="text-sm text-white/80">
                        {row.offerTitle || row.offerId}
                      </TableCell>
                      <TableCell className="text-xs text-white/60">
                        {scopeLabel(row.scope)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.isActive ? "default" : "secondary"}>
                          {row.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMut.mutate(row.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data && (
                <ListPagination
                  page={page}
                  total={data.total}
                  totalPages={data.totalPages}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#013644] text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                  placeholder="SAVE50"
                />
              </div>
              <div className="grid gap-2">
                <Label>Kind</Label>
                <select
                  className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm"
                  value={form.kind}
                  onChange={(e) =>
                    setForm({ ...form, kind: e.target.value as CouponKind })
                  }
                >
                  <option className="bg-[#013644]" value="coupon">
                    Coupon
                  </option>
                  <option className="bg-[#013644]" value="voucher">
                    Voucher
                  </option>
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            <div className="space-y-2 rounded-md border border-white/10 p-3">
              <Label>Linked customer offer</Label>
              <p className="text-xs text-white/50">
                Required. The code unlocks this offer&apos;s discount at checkout.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Search offers"
                  value={offerSearch}
                  onChange={(e) => setOfferSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void runOfferSearch();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={() => void runOfferSearch()}>
                  {searchingOffers ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>
              {form.offerId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-[#98E32F] bg-[#98E32F] px-2 py-1 text-xs text-[#013644]">
                    {form.offerTitle || form.offerId}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-white/60 underline"
                    onClick={() => setForm({ ...form, offerId: "", offerTitle: "" })}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {offerOptions
                  .filter((o) => o.id !== form.offerId)
                  .map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className="rounded border border-white/20 px-2 py-1 text-xs text-white"
                      onClick={() =>
                        setForm({
                          ...form,
                          offerId: o.id,
                          offerTitle: o.title,
                          title: form.title || o.title,
                        })
                      }
                    >
                      {o.title}
                      {o.type ? ` · ${o.type}` : ""}
                    </button>
                  ))}
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-white/10 p-3">
              <Label>Applies to</Label>
              <select
                className="h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm"
                value={form.scope}
                onChange={(e) => {
                  const scope = e.target.value as CouponScope;
                  setForm({
                    ...form,
                    scope,
                    restaurantIds: scope === "restaurants" ? form.restaurantIds : [],
                    menuItemIds: scope === "items" ? form.menuItemIds : [],
                    categoryNames: scope === "categories" ? form.categoryNames : [],
                  });
                  setDishFilterRestaurantId("");
                }}
              >
                <option className="bg-[#013644]" value="all">
                  Everywhere (no extra limit)
                </option>
                <option className="bg-[#013644]" value="restaurants">
                  Specific restaurants
                </option>
                <option className="bg-[#013644]" value="items">
                  Specific dishes
                </option>
                <option className="bg-[#013644]" value="categories">
                  Specific categories
                </option>
              </select>
              <p className="text-xs text-white/50">
                Optional extra limit for this code, on top of the linked offer.
              </p>

              {form.scope === "restaurants" && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <Input
                      value={restoSearch}
                      onChange={(e) => setRestoSearch(e.target.value)}
                      placeholder="Search restaurants"
                    />
                    <Button type="button" variant="outline" onClick={() => void runRestoSearch()}>
                      Search
                    </Button>
                  </div>
                  {form.restaurantIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.restaurantIds.map((id) => {
                        const name =
                          restoOptions.find((r) => r.id === id)?.name ||
                          `Restaurant ${id.slice(-6)}`;
                        return (
                          <button
                            key={id}
                            type="button"
                            className="rounded border border-[#98E32F] bg-[#98E32F] px-2 py-1 text-xs text-[#013644]"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                restaurantIds: f.restaurantIds.filter((x) => x !== id),
                              }))
                            }
                          >
                            {name} ×
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {restoOptions
                      .filter((r) => !form.restaurantIds.includes(r.id))
                      .map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="rounded border border-white/20 px-2 py-1 text-xs text-white"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              restaurantIds: [...f.restaurantIds, r.id],
                            }))
                          }
                        >
                          {r.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {form.scope === "items" && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <Input
                      value={restoSearch}
                      onChange={(e) => setRestoSearch(e.target.value)}
                      placeholder="Optional: filter dishes by restaurant"
                    />
                    <Button type="button" variant="outline" onClick={() => void runRestoSearch()}>
                      Find restaurant
                    </Button>
                  </div>
                  {restoOptions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`rounded border px-2 py-1 text-xs ${
                          !dishFilterRestaurantId
                            ? "border-[#98E32F] bg-[#98E32F] text-[#013644]"
                            : "border-white/20 text-white"
                        }`}
                        onClick={() => setDishFilterRestaurantId("")}
                      >
                        Any restaurant
                      </button>
                      {restoOptions.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className={`rounded border px-2 py-1 text-xs ${
                            dishFilterRestaurantId === r.id
                              ? "border-[#98E32F] bg-[#98E32F] text-[#013644]"
                              : "border-white/20 text-white"
                          }`}
                          onClick={() => setDishFilterRestaurantId(r.id)}
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={dishSearch}
                      onChange={(e) => setDishSearch(e.target.value)}
                      placeholder="Search dishes"
                    />
                    <Button type="button" variant="outline" onClick={() => void runDishSearch()}>
                      Search
                    </Button>
                  </div>
                  {form.menuItemIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.menuItemIds.map((id) => {
                        const name =
                          dishOptions.find((d) => d.id === id)?.name || `Dish ${id.slice(-6)}`;
                        return (
                          <button
                            key={id}
                            type="button"
                            className="rounded border border-[#98E32F] bg-[#98E32F] px-2 py-1 text-xs text-[#013644]"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                menuItemIds: f.menuItemIds.filter((x) => x !== id),
                              }))
                            }
                          >
                            {name} ×
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {dishOptions
                      .filter((d) => !form.menuItemIds.includes(d.id))
                      .map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          className="rounded border border-white/20 px-2 py-1 text-xs text-white"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              menuItemIds: [...f.menuItemIds, d.id],
                            }))
                          }
                        >
                          {d.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {form.scope === "categories" && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <Input
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder="Search categories"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void runCategorySearch()}
                    >
                      Search
                    </Button>
                  </div>
                  {form.categoryNames.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.categoryNames.map((name) => (
                        <button
                          key={name}
                          type="button"
                          className="rounded border border-[#98E32F] bg-[#98E32F] px-2 py-1 text-xs text-[#013644]"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              categoryNames: f.categoryNames.filter((x) => x !== name),
                            }))
                          }
                        >
                          {name} ×
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {categoryOptions
                      .filter((c) => !form.categoryNames.includes(c.name))
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="rounded border border-white/20 px-2 py-1 text-xs text-white"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              categoryNames: [...f.categoryNames, c.name],
                            }))
                          }
                        >
                          {c.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Usage limit (0 = unlimited)</Label>
                <Input
                  type="number"
                  value={form.usageLimit}
                  onChange={(e) =>
                    setForm({ ...form, usageLimit: Number(e.target.value) })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Per user limit</Label>
                <Input
                  type="number"
                  value={form.usagePerUser}
                  onChange={(e) =>
                    setForm({ ...form, usagePerUser: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Starts</Label>
                <Input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Ends</Label>
                <Input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
              />
              Active
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-[#98E32F] text-[#013644]"
                disabled={saveMut.isPending}
                onClick={() => saveMut.mutate()}
              >
                {saveMut.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
