"use client";

import { useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
  activateCustomerOffer,
  createCustomerOffer,
  deleteCustomerOffer,
  fetchCustomerOffers,
  searchOfferMenuItems,
  searchOfferRestaurants,
  updateCustomerOffer,
  type OfferMenuItemOption,
  type OfferRestaurantOption,
} from "@/lib/api/customer-offers";
import type {
  AdminCustomerOffer,
  CustomerOfferScope,
  CustomerOfferType,
  OfferFundingShareMode,
  OfferFundingSource,
  FreeDeliveryFundingSource,
} from "@/types/models";
import { ListPagination } from "@/components/ui/list-pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

const typeLabels: Record<CustomerOfferType, string> = {
  flat: "Flat ₹ off",
  percent: "Percentage off",
  free_delivery: "Free delivery",
  bogo: "Buy and get",
  combo: "Combo meal",
  order_cashback: "Spend and get cashback",
  order_count_cashback: "Complete N orders cashback",
};

type FormState = {
  title: string;
  subtitle: string;
  description: string;
  badgeLabel: string;
  badgeStyle: "green" | "blue" | "red";
  type: CustomerOfferType;
  minOrderAmount: number;
  maxDiscountAmount: number;
  discountValue: number;
  cashbackAmount: number;
  orderCountTarget: number;
  scope: CustomerOfferScope;
  restaurantIds: string[];
  menuItemIds: string[];
  buyMenuItemId: string;
  buyQty: number;
  getMenuItemId: string;
  getQty: number;
  getDiscountType: "free" | "percent" | "flat";
  getDiscountValue: number;
  comboRestaurantId: string;
  comboItems: { menuItemId: string; quantity: number; name: string }[];
  comboPrice: number;
  fundingSource: OfferFundingSource;
  fundingShareMode: OfferFundingShareMode;
  commissionShare: number;
  menuItemShare: number;
  maxDistanceKm: number;
  freeDeliveryFundingSource: FreeDeliveryFundingSource;
  startsAt: string;
  endsAt: string;
  autoApply: boolean;
  sendPushOnPublish: boolean;
  publishNow: boolean;
  usageLimit: number;
  usagePerUser: number;
};

const emptyForm = (): FormState => ({
  title: "",
  subtitle: "",
  description: "",
  badgeLabel: "OFFER",
  badgeStyle: "green",
  type: "flat",
  minOrderAmount: 0,
  maxDiscountAmount: 0,
  discountValue: 0,
  cashbackAmount: 0,
  orderCountTarget: 3,
  scope: "all",
  restaurantIds: [],
  menuItemIds: [],
  buyMenuItemId: "",
  buyQty: 1,
  getMenuItemId: "",
  getQty: 1,
  getDiscountType: "free",
  getDiscountValue: 0,
  comboRestaurantId: "",
  comboItems: [],
  comboPrice: 0,
  fundingSource: "commission",
  fundingShareMode: "percent",
  commissionShare: 100,
  menuItemShare: 0,
  maxDistanceKm: 0,
  freeDeliveryFundingSource: "platform",
  startsAt: "",
  endsAt: "",
  autoApply: true,
  sendPushOnPublish: true,
  publishNow: true,
  usageLimit: 0,
  usagePerUser: 0,
});

function formFromOffer(row: AdminCustomerOffer): FormState {
  return {
    ...emptyForm(),
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    badgeLabel: row.badgeLabel,
    badgeStyle: row.badgeStyle,
    type: row.type,
    minOrderAmount: row.minOrderAmount,
    maxDiscountAmount: row.maxDiscountAmount,
    discountValue: row.discountValue,
    cashbackAmount: row.cashbackAmount,
    orderCountTarget: row.orderCountTarget || 3,
    scope: row.scope,
    restaurantIds: row.restaurantIds,
    menuItemIds: row.menuItemIds,
    buyMenuItemId: row.buyMenuItemId || "",
    buyQty: row.buyQty,
    getMenuItemId: row.getMenuItemId || "",
    getQty: row.getQty,
    getDiscountType: row.getDiscountType,
    getDiscountValue: row.getDiscountValue,
    comboRestaurantId: row.comboRestaurantId || "",
    comboItems: row.comboItems.map((c) => ({
      menuItemId: c.menuItemId,
      quantity: c.quantity,
      name: c.name || "",
    })),
    comboPrice: row.comboPrice,
    fundingSource: row.fundingSource,
    fundingShareMode: row.fundingShareMode,
    commissionShare: row.commissionShare,
    menuItemShare: row.menuItemShare,
    maxDistanceKm: row.maxDistanceKm || 0,
    freeDeliveryFundingSource: row.freeDeliveryFundingSource || "platform",
    startsAt: row.startsAt ? row.startsAt.slice(0, 16) : "",
    endsAt: row.endsAt ? row.endsAt.slice(0, 16) : "",
    autoApply: row.autoApply,
    sendPushOnPublish: row.sendPushOnPublish,
    publishNow: row.status === "active",
    usageLimit: row.usageLimit,
    usagePerUser: row.usagePerUser,
  };
}

function payloadFromForm(form: FormState) {
  return {
    ...form,
    restaurantIds: form.restaurantIds,
    menuItemIds: form.menuItemIds,
    buyMenuItemId: form.buyMenuItemId || null,
    getMenuItemId: form.getMenuItemId || null,
    comboRestaurantId: form.comboRestaurantId || null,
    startsAt: form.startsAt || null,
    endsAt: form.endsAt || null,
    publishNow: form.publishNow,
    status: form.publishNow ? "active" : "draft",
  };
}

export default function CustomerOffersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [restoSearch, setRestoSearch] = useState("");
  const [dishSearch, setDishSearch] = useState("");
  const [restoOptions, setRestoOptions] = useState<OfferRestaurantOption[]>([]);
  const [dishOptions, setDishOptions] = useState<OfferMenuItemOption[]>([]);

  const listQuery = useQuery({
    queryKey: ["customer-offers", page],
    queryFn: () => fetchCustomerOffers({ page, limit: DEFAULT_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const createMut = useMutation({
    mutationFn: createCustomerOffer,
    onSuccess: async () => {
      toast.success("Offer created. Push will send if published.");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["customer-offers"] });
    },
    onError: () => toast.error("Could not create offer"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      updateCustomerOffer(id, patch),
    onSuccess: async () => {
      toast.success("Offer updated");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["customer-offers"] });
    },
    onError: () => toast.error("Could not update offer"),
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => activateCustomerOffer(id, true),
    onSuccess: async () => {
      toast.success("Offer is live and customers were notified");
      await queryClient.invalidateQueries({ queryKey: ["customer-offers"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteCustomerOffer,
    onSuccess: async () => {
      toast.success("Offer deleted");
      await queryClient.invalidateQueries({ queryKey: ["customer-offers"] });
    },
  });

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data;

  const needsRestaurants = form.scope === "restaurants" || form.type === "combo";
  const needsItems = form.scope === "items" || form.type === "bogo" || form.type === "combo";

  async function runRestoSearch() {
    try {
      setRestoOptions(await searchOfferRestaurants(restoSearch));
    } catch {
      toast.error("Restaurant search failed");
    }
  }

  async function runDishSearch() {
    try {
      setDishOptions(
        await searchOfferMenuItems({
          search: dishSearch,
          restaurantId: form.comboRestaurantId || form.restaurantIds[0],
        }),
      );
    } catch {
      toast.error("Menu search failed");
    }
  }

  const fundingHint = useMemo(() => {
    if (form.fundingSource === "commission")
      return "Platform commission absorbs the discount.";
    if (form.fundingSource === "menu_item")
      return "Restaurant item payout is reduced by the discount.";
    return "Split the discount between commission and restaurant item amount.";
  }, [form.fundingSource]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(row: AdminCustomerOffer) {
    setEditingId(row.id);
    setForm(formFromOffer(row));
    setOpen(true);
  }

  function save() {
    const payload = payloadFromForm(form);
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (editingId) updateMut.mutate({ id: editingId, patch: payload });
    else createMut.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Customer offers</h1>
          <p className="mt-1 text-sm text-white/60">
            Flat, percent, buy-and-get, combo, cashback, and who pays: commission, menu item, or both.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90">
          <Plus className="mr-2 h-4 w-4" />
          New offer
        </Button>
      </div>

      <Card className="border-white/10 bg-[#042c38]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Gift className="h-5 w-5 text-[#98E32F]" />
            Offers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Offer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Funding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium text-white">{row.title}</div>
                        <div className="text-xs text-white/50">{row.subtitle}</div>
                      </TableCell>
                      <TableCell className="text-white/80">{typeLabels[row.type]}</TableCell>
                      <TableCell className="text-white/80">
                        <div>
                          {row.fundingSource === "both"
                            ? `Both (${row.commissionShare}/${row.menuItemShare})`
                            : row.fundingSource === "menu_item"
                              ? "Menu item"
                              : "Commission"}
                        </div>
                        {row.maxDistanceKm > 0 && (
                          <div className="text-xs text-white/50">
                            ≤ {row.maxDistanceKm} km
                          </div>
                        )}
                        {row.type === "free_delivery" && (
                          <div className="text-xs text-white/50">
                            Delivery:{" "}
                            {row.freeDeliveryFundingSource === "restaurant"
                              ? "restaurant"
                              : "platform"}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.status}</Badge>
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        {row.status !== "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => activateMut.mutate(row.id)}
                          >
                            Go live + push
                          </Button>
                        )}
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
              {meta && (
                <ListPagination
                  page={page}
                  total={meta.total}
                  totalPages={meta.totalPages}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#013644] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingId ? "Edit offer" : "Create offer"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Subtitle (shown in app)</Label>
              <Input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Type</Label>
                <select
                  className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm text-white"
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value as CustomerOfferType })
                  }
                >
                  {Object.entries(typeLabels).map(([k, v]) => (
                    <option key={k} value={k} className="bg-[#013644]">
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Badge</Label>
                <Input
                  value={form.badgeLabel}
                  onChange={(e) => setForm({ ...form, badgeLabel: e.target.value })}
                />
              </div>
            </div>

            {(form.type === "flat" || form.type === "percent") && (
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label>{form.type === "flat" ? "₹ off" : "% off"}</Label>
                  <Input
                    type="number"
                    value={form.discountValue}
                    onChange={(e) =>
                      setForm({ ...form, discountValue: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Min order ₹</Label>
                  <Input
                    type="number"
                    value={form.minOrderAmount}
                    onChange={(e) =>
                      setForm({ ...form, minOrderAmount: Number(e.target.value) })
                    }
                  />
                </div>
                {form.type === "percent" && (
                  <div className="grid gap-2">
                    <Label>Max cap ₹</Label>
                    <Input
                      type="number"
                      value={form.maxDiscountAmount}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          maxDiscountAmount: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {form.type === "free_delivery" && (
              <div className="grid gap-2">
                <Label>Min order ₹ for free delivery</Label>
                <Input
                  type="number"
                  value={form.minOrderAmount}
                  onChange={(e) =>
                    setForm({ ...form, minOrderAmount: Number(e.target.value) })
                  }
                />
              </div>
            )}

            {form.type === "order_cashback" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Spend at least ₹</Label>
                  <Input
                    type="number"
                    value={form.minOrderAmount}
                    onChange={(e) =>
                      setForm({ ...form, minOrderAmount: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Cashback ₹</Label>
                  <Input
                    type="number"
                    value={form.cashbackAmount}
                    onChange={(e) =>
                      setForm({ ...form, cashbackAmount: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            )}

            {form.type === "order_count_cashback" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Complete N orders</Label>
                  <Input
                    type="number"
                    value={form.orderCountTarget}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        orderCountTarget: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Cashback ₹</Label>
                  <Input
                    type="number"
                    value={form.cashbackAmount}
                    onChange={(e) =>
                      setForm({ ...form, cashbackAmount: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            )}

            {form.type === "bogo" && (
              <div className="space-y-3 rounded-md border border-white/10 p-3">
                <p className="text-sm text-white/70">Buy item A, get item B free or cheaper.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Buy qty</Label>
                    <Input
                      type="number"
                      value={form.buyQty}
                      onChange={(e) =>
                        setForm({ ...form, buyQty: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Get qty</Label>
                    <Input
                      type="number"
                      value={form.getQty}
                      onChange={(e) =>
                        setForm({ ...form, getQty: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search dishes"
                    value={dishSearch}
                    onChange={(e) => setDishSearch(e.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={runDishSearch}>
                    Search
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dishOptions.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="rounded border border-white/20 px-2 py-1 text-xs text-white"
                      onClick={() =>
                        setForm((f) =>
                          f.buyMenuItemId
                            ? { ...f, getMenuItemId: d.id }
                            : { ...f, buyMenuItemId: d.id },
                        )
                      }
                    >
                      {d.name} ₹{d.price}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/50">
                  Buy item: {form.buyMenuItemId || "—"} · Get item: {form.getMenuItemId || "same / pick"}
                </p>
              </div>
            )}

            {form.type === "combo" && (
              <div className="space-y-3 rounded-md border border-white/10 p-3">
                <Label>Combo restaurant</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search restaurants"
                    value={restoSearch}
                    onChange={(e) => setRestoSearch(e.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={runRestoSearch}>
                    Search
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {restoOptions.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`rounded border px-2 py-1 text-xs ${
                        form.comboRestaurantId === r.id
                          ? "border-[#98E32F] bg-[#98E32F] text-[#013644]"
                          : "border-white/20 text-white"
                      }`}
                      onClick={() => setForm({ ...form, comboRestaurantId: r.id })}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add combo dishes"
                    value={dishSearch}
                    onChange={(e) => setDishSearch(e.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={runDishSearch}>
                    Search
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dishOptions.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="rounded border border-white/20 px-2 py-1 text-xs text-white"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          comboItems: f.comboItems.some((c) => c.menuItemId === d.id)
                            ? f.comboItems
                            : [
                                ...f.comboItems,
                                { menuItemId: d.id, quantity: 1, name: d.name },
                              ],
                        }))
                      }
                    >
                      + {d.name} ₹{d.price}
                    </button>
                  ))}
                </div>
                <ul className="space-y-1 text-sm text-white/80">
                  {form.comboItems.map((c) => (
                    <li key={c.menuItemId} className="flex items-center justify-between">
                      <span>
                        {c.name || c.menuItemId} ×{c.quantity}
                      </span>
                      <button
                        type="button"
                        className="text-red-300"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            comboItems: f.comboItems.filter(
                              (x) => x.menuItemId !== c.menuItemId,
                            ),
                          }))
                        }
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="grid gap-2">
                  <Label>Combo offer price ₹</Label>
                  <Input
                    type="number"
                    value={form.comboPrice}
                    onChange={(e) =>
                      setForm({ ...form, comboPrice: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Max distance (km)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.maxDistanceKm}
                  onChange={(e) =>
                    setForm({ ...form, maxDistanceKm: Number(e.target.value) })
                  }
                />
                <p className="text-xs text-white/50">
                  0 = no limit. Customer must be within this distance to use the offer.
                </p>
              </div>
              {form.type === "free_delivery" && (
                <div className="grid gap-2">
                  <Label>Who pays free delivery?</Label>
                  <select
                    className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm text-white"
                    value={form.freeDeliveryFundingSource}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        freeDeliveryFundingSource: e.target.value as FreeDeliveryFundingSource,
                      })
                    }
                  >
                    <option className="bg-[#013644]" value="platform">
                      Platform wallet
                    </option>
                    <option className="bg-[#013644]" value="restaurant">
                      Restaurant (deduct from settlement)
                    </option>
                  </select>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Who pays the discount?</Label>
              <select
                className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm text-white"
                value={form.fundingSource}
                onChange={(e) =>
                  setForm({
                    ...form,
                    fundingSource: e.target.value as OfferFundingSource,
                  })
                }
              >
                <option className="bg-[#013644]" value="commission">
                  Deduct from commission
                </option>
                <option className="bg-[#013644]" value="menu_item">
                  Deduct from menu item (restaurant)
                </option>
                <option className="bg-[#013644]" value="both">
                  Split between both
                </option>
              </select>
              <p className="text-xs text-white/50">{fundingHint}</p>
            </div>

            {form.fundingSource === "both" && (
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label>Share mode</Label>
                  <select
                    className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm text-white"
                    value={form.fundingShareMode}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        fundingShareMode: e.target.value as OfferFundingShareMode,
                      })
                    }
                  >
                    <option className="bg-[#013644]" value="percent">
                      Percent
                    </option>
                    <option className="bg-[#013644]" value="amount">
                      Amount ₹
                    </option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Commission share</Label>
                  <Input
                    type="number"
                    value={form.commissionShare}
                    onChange={(e) =>
                      setForm({ ...form, commissionShare: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Menu item share</Label>
                  <Input
                    type="number"
                    value={form.menuItemShare}
                    onChange={(e) =>
                      setForm({ ...form, menuItemShare: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            )}

            {needsRestaurants && form.type !== "combo" && (
              <div className="space-y-2">
                <Label>Limit to restaurants</Label>
                <div className="flex gap-2">
                  <Input
                    value={restoSearch}
                    onChange={(e) => setRestoSearch(e.target.value)}
                    placeholder="Search restaurants"
                  />
                  <Button type="button" variant="outline" onClick={runRestoSearch}>
                    Search
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {restoOptions.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`rounded border px-2 py-1 text-xs ${
                        form.restaurantIds.includes(r.id)
                          ? "border-[#98E32F] bg-[#98E32F] text-[#013644]"
                          : "border-white/20 text-white"
                      }`}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          restaurantIds: f.restaurantIds.includes(r.id)
                            ? f.restaurantIds.filter((id) => id !== r.id)
                            : [...f.restaurantIds, r.id],
                        }))
                      }
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {needsItems && form.type !== "combo" && form.type !== "bogo" && (
              <div className="space-y-2">
                <Label>Limit to dishes</Label>
                <div className="flex gap-2">
                  <Input
                    value={dishSearch}
                    onChange={(e) => setDishSearch(e.target.value)}
                    placeholder="Search dishes"
                  />
                  <Button type="button" variant="outline" onClick={runDishSearch}>
                    Search
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dishOptions.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`rounded border px-2 py-1 text-xs ${
                        form.menuItemIds.includes(d.id)
                          ? "border-[#98E32F] bg-[#98E32F] text-[#013644]"
                          : "border-white/20 text-white"
                      }`}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          menuItemIds: f.menuItemIds.includes(d.id)
                            ? f.menuItemIds.filter((id) => id !== d.id)
                            : [...f.menuItemIds, d.id],
                        }))
                      }
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

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

            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={form.publishNow}
                onChange={(e) => setForm({ ...form, publishNow: e.target.checked })}
              />
              Publish now (active)
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={form.sendPushOnPublish}
                onChange={(e) =>
                  setForm({ ...form, sendPushOnPublish: e.target.checked })
                }
              />
              Send push notification to customers
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={form.autoApply}
                onChange={(e) => setForm({ ...form, autoApply: e.target.checked })}
              />
              Auto-apply in cart
            </label>

            <Button
              onClick={save}
              disabled={createMut.isPending || updateMut.isPending}
              className="bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90"
            >
              {createMut.isPending || updateMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                "Save changes"
              ) : (
                "Create offer"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
