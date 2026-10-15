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
  searchCouponCustomers,
  searchCouponMenuItems,
  searchCouponOffers,
  searchCouponRestaurants,
  updateCoupon,
  type AdminCoupon,
  type CouponCategoryOption,
  type CouponAudienceRules,
  type CouponCustomerOption,
  type CouponDiscountType,
  type CouponFundingSource,
  type CouponKind,
  type CouponLifecycle,
  type CouponRestaurantAffinity,
  type CouponMenuItemOption,
  type CouponOfferOption,
  type CouponRestaurantOption,
  type CouponScope,
} from "@/lib/api/coupons";
import { ListPagination } from "@/components/ui/list-pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

type CustomerSpec =
  | "everyone"
  | "new"
  | "returning"
  | "lapsed"
  | "first_at_restaurant"
  | "specific"
  | "custom";

const defaultAudienceRules = (): CouponAudienceRules => ({
  lifecycle: "all",
  lapsedAfterDays: 30,
  minOrderCount: 0,
  maxOrderCount: 0,
  minAov: 0,
  maxAov: 0,
  restaurantAffinity: "any",
});

function customerSpecFromRow(row: AdminCoupon): CustomerSpec {
  if ((row.customerIds?.length ?? 0) > 0) return "specific";
  const rules = { ...defaultAudienceRules(), ...(row.audienceRules || {}) };
  if (!row.audience || row.audience === "all") return "everyone";
  const hasExtra =
    rules.minOrderCount > 0 ||
    rules.maxOrderCount > 0 ||
    rules.minAov > 0 ||
    rules.maxAov > 0;
  if (!hasExtra && rules.lifecycle === "all" && rules.restaurantAffinity === "never_ordered") {
    return "first_at_restaurant";
  }
  if (hasExtra || rules.restaurantAffinity !== "any") return "custom";
  if (rules.lifecycle === "new") return "new";
  if (rules.lifecycle === "returning") return "returning";
  if (rules.lifecycle === "lapsed") return "lapsed";
  return "custom";
}

function audiencePayload(form: FormState): {
  audience: "all" | "segment";
  audienceRules: CouponAudienceRules;
  customerIds: string[];
} {
  if (form.customerSpec === "specific") {
    return {
      audience: "all",
      audienceRules: defaultAudienceRules(),
      customerIds: form.customers.map((c) => c.id),
    };
  }
  if (form.customerSpec === "everyone") {
    return { audience: "all", audienceRules: defaultAudienceRules(), customerIds: [] };
  }
  const rules = defaultAudienceRules();
  if (form.customerSpec === "new") rules.lifecycle = "new";
  else if (form.customerSpec === "returning") rules.lifecycle = "returning";
  else if (form.customerSpec === "lapsed") {
    rules.lifecycle = "lapsed";
    rules.lapsedAfterDays = Math.max(1, form.audienceRules.lapsedAfterDays || 30);
  } else if (form.customerSpec === "first_at_restaurant") {
    rules.restaurantAffinity = "never_ordered";
  } else {
    return {
      audience: "segment",
      audienceRules: form.audienceRules,
      customerIds: [],
    };
  }
  return { audience: "segment", audienceRules: rules, customerIds: [] };
}

type FormState = {
  code: string;
  kind: CouponKind;
  title: string;
  description: string;
  offerId: string;
  offerTitle: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount: number;
  minOrderAmount: number;
  fundingSource: CouponFundingSource;
  commissionShare: number;
  menuItemShare: number;
  scope: CouponScope;
  restaurantIds: string[];
  menuItemIds: string[];
  categoryNames: string[];
  customerSpec: CustomerSpec;
  audienceRules: CouponAudienceRules;
  customers: CouponCustomerOption[];
  usageLimit: number;
  usagePerUser: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

function customerLabel(c: CouponCustomerOption) {
  const name = c.name || "Customer";
  const contact = c.phone || c.email;
  return contact ? `${name} · ${contact}` : name;
}

function audienceLabel(row: AdminCoupon) {
  const count = row.customerIds?.length ?? 0;
  if (count === 1 && row.customers?.[0]) return customerLabel(row.customers[0]);
  if (count > 1) return `${count} customers`;
  if (count === 1) return "1 customer";
  const spec = customerSpecFromRow(row);
  if (spec === "new") return "New customers";
  if (spec === "returning") return "Returning";
  if (spec === "lapsed") return "Lapsed";
  if (spec === "first_at_restaurant") return "First order here";
  if (spec === "custom") return "Custom segment";
  return "Everyone";
}

const emptyForm = (): FormState => ({
  code: "",
  kind: "coupon",
  title: "",
  description: "",
  offerId: "",
  offerTitle: "",
  discountType: "flat",
  discountValue: 0,
  maxDiscountAmount: 0,
  minOrderAmount: 0,
  fundingSource: "commission",
  commissionShare: 50,
  menuItemShare: 50,
  scope: "all",
  restaurantIds: [],
  menuItemIds: [],
  categoryNames: [],
  customerSpec: "everyone",
  audienceRules: defaultAudienceRules(),
  customers: [],
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
    discountType: row.discountType || "flat",
    discountValue: row.discountValue || 0,
    maxDiscountAmount: row.maxDiscountAmount || 0,
    minOrderAmount: row.minOrderAmount || 0,
    fundingSource: row.fundingSource || "commission",
    commissionShare: row.commissionShare ?? 50,
    menuItemShare: row.menuItemShare ?? 50,
    scope: row.scope || "all",
    restaurantIds: row.restaurantIds || [],
    menuItemIds: row.menuItemIds || [],
    categoryNames: row.categoryNames || [],
    customerSpec: customerSpecFromRow(row),
    audienceRules: { ...defaultAudienceRules(), ...(row.audienceRules || {}) },
    customers:
      row.customers && row.customers.length > 0
        ? row.customers
        : (row.customerIds || []).map((id) => ({
            id,
            name: `Customer ${id.slice(-6)}`,
            phone: "",
            email: "",
          })),
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
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOptions, setCustomerOptions] = useState<CouponCustomerOption[]>([]);

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
      if (!form.offerId && !(form.discountValue > 0)) {
        throw new Error("Enter a discount, or link a customer offer");
      }
      if (!form.offerId && form.discountType === "percent" && form.discountValue > 100) {
        throw new Error("Percent discount cannot exceed 100");
      }
      if (form.scope === "restaurants" && form.restaurantIds.length === 0) {
        throw new Error("Select at least one restaurant");
      }
      if (form.scope === "items" && form.menuItemIds.length === 0) {
        throw new Error("Select at least one dish");
      }
      if (form.scope === "categories" && form.categoryNames.length === 0) {
        throw new Error("Select at least one category");
      }
      if (form.customerSpec === "specific" && form.customers.length === 0) {
        throw new Error("Select at least one customer");
      }
      const payload = {
        code: form.code.trim().toUpperCase(),
        kind: form.kind,
        title: form.title.trim(),
        description: form.description.trim(),
        offerId: form.offerId,
        discountType: form.discountType,
        discountValue: form.discountValue,
        maxDiscountAmount: form.discountType === "percent" ? form.maxDiscountAmount : 0,
        minOrderAmount: form.minOrderAmount,
        fundingSource: form.fundingSource,
        fundingShareMode: "percent" as const,
        commissionShare:
          form.fundingSource === "commission"
            ? 100
            : form.fundingSource === "menu_item"
              ? 0
              : form.commissionShare,
        menuItemShare:
          form.fundingSource === "menu_item"
            ? 100
            : form.fundingSource === "commission"
              ? 0
              : form.menuItemShare,
        scope: form.scope,
        restaurantIds: form.scope === "restaurants" ? form.restaurantIds : [],
        menuItemIds: form.scope === "items" ? form.menuItemIds : [],
        categoryNames: form.scope === "categories" ? form.categoryNames : [],
        ...audiencePayload(form),
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

  async function runCustomerSearch() {
    try {
      setCustomerOptions(await searchCouponCustomers(customerSearch));
    } catch {
      toast.error("Customer search failed");
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
    setCustomerSearch("");
    setCustomerOptions([]);
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
    setCustomerSearch("");
    setCustomerOptions([]);
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
            Create a code with its own discount, or link it to a customer offer. Limit it to
            restaurants, dishes, or categories when you need to.
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
                    <TableHead>Customers</TableHead>
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
                        {row.offerId
                          ? row.offerTitle || row.offerId
                          : row.discountType === "percent"
                            ? `${row.discountValue || 0}% off`
                            : `₹${row.discountValue || 0} off`}
                      </TableCell>
                      <TableCell className="text-xs text-white/60">
                        {scopeLabel(row.scope)}
                      </TableCell>
                      <TableCell className="text-xs text-white/60">
                        {audienceLabel(row)}
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

            {!form.offerId && (
              <div className="space-y-3 rounded-md border border-white/10 p-3">
                <Label>Discount</Label>
                <p className="text-xs text-white/50">
                  Applied at checkout when the customer enters this code. Leave this out only if you
                  link an offer below.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <select
                      className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm"
                      value={form.discountType}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          discountType: e.target.value as CouponDiscountType,
                        })
                      }
                    >
                      <option className="bg-[#013644]" value="flat">
                        Flat ₹ off
                      </option>
                      <option className="bg-[#013644]" value="percent">
                        Percent off
                      </option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label>{form.discountType === "percent" ? "Percent" : "Amount ₹"}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={form.discountType === "percent" ? 100 : undefined}
                      value={form.discountValue}
                      onChange={(e) =>
                        setForm({ ...form, discountValue: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {form.discountType === "percent" && (
                    <div className="grid gap-2">
                      <Label>Max discount ₹ (0 = no cap)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.maxDiscountAmount}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            maxDiscountAmount: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                      />
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label>Min order ₹ (0 = none)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.minOrderAmount}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          minOrderAmount: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Who pays the discount?</Label>
                  <select
                    className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm"
                    value={form.fundingSource}
                    onChange={(e) => {
                      const fundingSource = e.target.value as CouponFundingSource;
                      setForm({
                        ...form,
                        fundingSource,
                        ...(fundingSource === "both" &&
                        form.commissionShare + form.menuItemShare !== 100
                          ? { commissionShare: 50, menuItemShare: 50 }
                          : {}),
                      });
                    }}
                  >
                    <option className="bg-[#013644]" value="commission">
                      From platform wallet
                    </option>
                    <option className="bg-[#013644]" value="menu_item">
                      Restaurant wallet
                    </option>
                    <option className="bg-[#013644]" value="both">
                      Split
                    </option>
                  </select>
                </div>
                {form.fundingSource === "both" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Platform wallet %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={form.commissionShare}
                        onChange={(e) => {
                          const next = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                          setForm({
                            ...form,
                            commissionShare: next,
                            menuItemShare: Math.round((100 - next) * 100) / 100,
                          });
                        }}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Restaurant wallet %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={form.menuItemShare}
                        onChange={(e) => {
                          const next = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                          setForm({
                            ...form,
                            menuItemShare: next,
                            commissionShare: Math.round((100 - next) * 100) / 100,
                          });
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 rounded-md border border-white/10 p-3">
              <Label>Linked customer offer (optional)</Label>
              <p className="text-xs text-white/50">
                If you link an offer, checkout uses that offer&apos;s discount instead of the amount
                above.
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
                Optional limit for this code.
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

            <div className="space-y-2 rounded-md border border-white/10 p-3">
              <Label>Customers</Label>
              <select
                className="h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm"
                value={form.customerSpec}
                onChange={(e) => {
                  const customerSpec = e.target.value as CustomerSpec;
                  setForm({
                    ...form,
                    customerSpec,
                    ...(customerSpec === "first_at_restaurant" && form.usagePerUser === 0
                      ? { usagePerUser: 1 }
                      : {}),
                  });
                }}
              >
                <option className="bg-[#013644]" value="everyone">
                  All customers
                </option>
                <option className="bg-[#013644]" value="new">
                  New customers (0 orders)
                </option>
                <option className="bg-[#013644]" value="returning">
                  Returning customers
                </option>
                <option className="bg-[#013644]" value="lapsed">
                  Lapsed customers
                </option>
                <option className="bg-[#013644]" value="first_at_restaurant">
                  First order at this restaurant
                </option>
                <option className="bg-[#013644]" value="specific">
                  Specific customers only
                </option>
                <option className="bg-[#013644]" value="custom">
                  Custom segment
                </option>
              </select>
              <p className="text-xs text-white/50">
                Checkout only accepts the code for customers in this group. A linked offer can
                narrow it further.
              </p>
              {form.customerSpec === "lapsed" && (
                <div className="grid gap-2">
                  <Label>Lapsed after (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.audienceRules.lapsedAfterDays}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        audienceRules: {
                          ...form.audienceRules,
                          lapsedAfterDays: Math.max(1, Number(e.target.value) || 30),
                        },
                      })
                    }
                  />
                </div>
              )}
              {form.customerSpec === "first_at_restaurant" && (
                <p className="text-xs text-white/50">
                  The customer has no delivered order at the restaurant in this cart. If you limit
                  the code to restaurants, it only works at those restaurants. Usage per user is
                  set to 1.
                </p>
              )}
              {form.customerSpec === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Lifecycle</Label>
                    <select
                      className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm"
                      value={form.audienceRules.lifecycle}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          audienceRules: {
                            ...form.audienceRules,
                            lifecycle: e.target.value as CouponLifecycle,
                          },
                        })
                      }
                    >
                      <option className="bg-[#013644]" value="all">Any</option>
                      <option className="bg-[#013644]" value="new">New</option>
                      <option className="bg-[#013644]" value="returning">Returning</option>
                      <option className="bg-[#013644]" value="lapsed">Lapsed</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Restaurant history</Label>
                    <select
                      className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm"
                      value={form.audienceRules.restaurantAffinity}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          audienceRules: {
                            ...form.audienceRules,
                            restaurantAffinity: e.target.value as CouponRestaurantAffinity,
                          },
                        })
                      }
                    >
                      <option className="bg-[#013644]" value="any">Any</option>
                      <option className="bg-[#013644]" value="has_ordered">Has ordered here</option>
                      <option className="bg-[#013644]" value="never_ordered">Never ordered here</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Min orders</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.audienceRules.minOrderCount}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          audienceRules: {
                            ...form.audienceRules,
                            minOrderCount: Math.max(0, Number(e.target.value) || 0),
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Max orders (0 = none)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.audienceRules.maxOrderCount}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          audienceRules: {
                            ...form.audienceRules,
                            maxOrderCount: Math.max(0, Number(e.target.value) || 0),
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Min average order ₹</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.audienceRules.minAov}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          audienceRules: {
                            ...form.audienceRules,
                            minAov: Math.max(0, Number(e.target.value) || 0),
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Max average order ₹ (0 = none)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.audienceRules.maxAov}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          audienceRules: {
                            ...form.audienceRules,
                            maxAov: Math.max(0, Number(e.target.value) || 0),
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {form.customerSpec === "specific" && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <Input
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void runCustomerSearch();
                        }
                      }}
                      placeholder="Search by name, phone or email"
                    />
                    <Button type="button" variant="outline" onClick={() => void runCustomerSearch()}>
                      Search
                    </Button>
                  </div>
                  {form.customers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.customers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="rounded border border-[#98E32F] bg-[#98E32F] px-2 py-1 text-xs text-[#013644]"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              customers: f.customers.filter((x) => x.id !== c.id),
                            }))
                          }
                        >
                          {customerLabel(c)} ×
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {customerOptions
                      .filter((c) => !form.customers.some((x) => x.id === c.id))
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="rounded border border-white/20 px-2 py-1 text-xs text-white"
                          onClick={() =>
                            setForm((f) => ({ ...f, customers: [...f.customers, c] }))
                          }
                        >
                          {customerLabel(c)}
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
