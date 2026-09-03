"use client";

import { useEffect, useMemo, useState } from "react";
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
  previewCustomerOffer,
  searchOfferMenuItems,
  searchOfferRestaurants,
  updateCustomerOffer,
  type OfferMenuItemOption,
  type OfferPreviewResult,
  type OfferRestaurantOption,
} from "@/lib/api/customer-offers";
import type {
  AdminCustomerOffer,
  AdminOfferAudienceRules,
  AudienceLifecycle,
  CustomerOfferAudience,
  CustomerOfferScope,
  CustomerOfferType,
  FreeDeliveryUnlock,
  OfferFundingShareMode,
  OfferFundingSource,
  FreeDeliveryFundingSource,
  RestaurantAffinity,
} from "@/types/models";
import { ListPagination } from "@/components/ui/list-pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

function inr(n: number | undefined | null) {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function OfferImpactPreviewPanel({
  preview,
  loading,
  error,
  assumptions,
  onAssumptionsChange,
}: {
  preview: OfferPreviewResult | undefined;
  loading: boolean;
  error: boolean;
  assumptions: {
    sampleCartAmount: number;
    sampleDeliveryFee: number;
    expectedOrderCount: number;
  };
  onAssumptionsChange: (patch: Partial<{
    sampleCartAmount: number;
    sampleDeliveryFee: number;
    expectedOrderCount: number;
  }>) => void;
}) {
  const per = preview?.perOrder;
  const chance = preview?.purchaseChance;
  const risk = preview?.riskSummary;
  const plColor =
    per?.platformProfitLoss === "profit"
      ? "text-emerald-300"
      : per?.platformProfitLoss === "loss"
        ? "text-red-300"
        : "text-amber-200";
  const chanceColor =
    chance?.score === "high"
      ? "text-emerald-300"
      : chance?.score === "low"
        ? "text-red-300"
        : "text-amber-200";

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Impact preview</h3>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/60" />}
      </div>
      <p className="text-xs text-white/50">
        Live estimate of customer savings, restaurant net, and platform profit/loss
        using the same funding rules as checkout settlement.
      </p>

      <div className="grid grid-cols-3 gap-2">
        <div className="grid gap-1">
          <Label className="text-[10px] text-white/50">Sample cart ₹</Label>
          <Input
            type="number"
            value={assumptions.sampleCartAmount}
            onChange={(e) =>
              onAssumptionsChange({ sampleCartAmount: Number(e.target.value) })
            }
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-[10px] text-white/50">Delivery fee ₹</Label>
          <Input
            type="number"
            value={assumptions.sampleDeliveryFee}
            onChange={(e) =>
              onAssumptionsChange({ sampleDeliveryFee: Number(e.target.value) })
            }
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-[10px] text-white/50">Expected orders</Label>
          <Input
            type="number"
            value={assumptions.expectedOrderCount}
            onChange={(e) =>
              onAssumptionsChange({ expectedOrderCount: Number(e.target.value) })
            }
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-300">Could not load preview. Check API.</p>
      )}

      {per && (
        <>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-white/10 p-2">
              <p className="text-white/50">Customer saves</p>
              <p className="text-base font-semibold text-[#98E32F]">
                {inr(per.customerSaves)}
              </p>
              <p className="text-white/40">Pays {inr(per.customerPays)}</p>
            </div>
            <div className="rounded border border-white/10 p-2">
              <p className="text-white/50">Restaurant receives</p>
              <p className="text-base font-semibold text-white">
                {inr(per.restaurantNet)}
              </p>
              <p className="text-white/40">
                After offer &amp; commission {inr(per.commissionAfterOffer)}
              </p>
            </div>
            <div className="rounded border border-white/10 p-2">
              <p className="text-white/50">Platform net / order</p>
              <p className={`text-base font-semibold ${plColor}`}>
                {inr(per.platformNet)}
              </p>
              <p className="text-white/40">
                Cost {inr(per.platformOfferCost)} · keeps {inr(per.platformCommissionRetained)}
              </p>
            </div>
            <div className="rounded border border-white/10 p-2">
              <p className="text-white/50">Funding</p>
              <p className="text-sm font-semibold capitalize text-white">
                {(preview?.fundingLabel || "none").replace(/-/g, " ")}
              </p>
              <p className="text-white/40">
                Comm {inr(per.offerFunding.commission)} · Menu{" "}
                {inr(per.offerFunding.menuItem)}
              </p>
            </div>
          </div>

          {risk && (
            <div className="rounded border border-white/10 p-2 text-xs">
              <p className="font-medium text-white">Profit / loss chance</p>
              <p className={`mt-1 capitalize ${plColor}`}>
                {risk.platformProfitLoss} · expected campaign net{" "}
                {inr(risk.expectedCampaignPlatformNet)}
              </p>
              <p className="mt-1 text-white/50">{risk.note}</p>
            </div>
          )}

          {chance && (
            <div className="rounded border border-white/10 p-2 text-xs">
              <p className="font-medium text-white">Customer purchase chance</p>
              <p className={`mt-1 text-base font-semibold capitalize ${chanceColor}`}>
                {chance.score} ({chance.scorePercent}%)
              </p>
              <p className="text-white/40">
                Based on {chance.deliveredOrderCount} delivered orders · AOV{" "}
                {inr(chance.avgOrderValue)}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-white/55">
                {chance.explainers.slice(0, 4).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {preview?.scenarios?.length ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-white/70">Campaign scenarios</p>
              {preview.scenarios.map((s) => (
                <div
                  key={s.key}
                  className="flex items-start justify-between gap-2 rounded border border-white/10 px-2 py-1.5 text-[11px]"
                >
                  <div>
                    <p className="font-medium text-white">{s.label}</p>
                    <p className="text-white/45">
                      {Math.round(s.conversionRate * 100)}% conv · {s.orderCount} orders
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white">Plat {inr(s.campaignPlatformNet)}</p>
                    <p className="text-white/45">Rest {inr(s.campaignRestaurantNet)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {preview?.restaurant && (
            <p className="text-[11px] text-white/40">
              Using {preview.restaurant.name || "restaurant"} · commission{" "}
              {preview.assumptions.commissionPercent}%
              {preview.assumptions.gstRegistered ? " · GST registered" : ""}
            </p>
          )}

          {preview?.audienceSize && (
            <div className="rounded border border-white/10 p-2 text-xs">
              <p className="font-medium text-white">Audience size</p>
              <p className="mt-1 text-base font-semibold text-[#98E32F]">
                {preview.audienceSize.matchingUsers.toLocaleString("en-IN")} customers
              </p>
              <p className="text-white/50">{preview.audienceSize.explainer}</p>
            </div>
          )}

          {preview?.comboEconomics && (
            <div className="rounded border border-white/10 p-2 text-xs">
              <p className="font-medium text-white">Combo economics</p>
              <p className="mt-1 text-white/80">
                Catalog {inr(preview.comboEconomics.catalogTotal)} → combo{" "}
                {inr(preview.comboEconomics.comboPrice)} (save{" "}
                {inr(preview.comboEconomics.comboSave)})
              </p>
              <p className="text-white/50">
                Commission captured on combo price {inr(preview.comboEconomics.commissionCaptured)}{" "}
                ({preview.comboEconomics.commissionPercent}%)
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const typeLabels: Record<CustomerOfferType, string> = {
  flat: "Flat ₹ off",
  percent: "Percentage off",
  free_delivery: "Free delivery",
  bogo: "Buy and get",
  combo: "Combo meal",
  order_cashback: "Spend and get cashback",
  order_count_cashback: "Complete N orders cashback",
};

type AudiencePreset = "everyone" | "new" | "returning" | "lapsed" | "custom";

type ComboFormItem = {
  menuItemId: string;
  quantity: number;
  name: string;
  variantName: string;
  unitPrice: number;
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
  buyVariantName: string;
  getVariantName: string;
  comboRestaurantId: string;
  comboItems: ComboFormItem[];
  comboPrice: number;
  fundingSource: OfferFundingSource;
  fundingShareMode: OfferFundingShareMode;
  commissionShare: number;
  menuItemShare: number;
  maxDistanceKm: number;
  freeDeliveryFundingSource: FreeDeliveryFundingSource;
  freeDeliveryUnlock: FreeDeliveryUnlock;
  commissionCoverMultiplier: number;
  audience: CustomerOfferAudience;
  audiencePreset: AudiencePreset;
  audienceRules: AdminOfferAudienceRules;
  startsAt: string;
  endsAt: string;
  autoApply: boolean;
  sendPushOnPublish: boolean;
  publishNow: boolean;
  usageLimit: number;
  usagePerUser: number;
};

function defaultAudienceRules(): AdminOfferAudienceRules {
  return {
    lifecycle: "all",
    lapsedAfterDays: 30,
    minOrderCount: 0,
    maxOrderCount: 0,
    minAov: 0,
    maxAov: 0,
    restaurantAffinity: "any",
  };
}

function audiencePresetFromOffer(
  audience: CustomerOfferAudience | undefined,
  rules: AdminOfferAudienceRules,
): AudiencePreset {
  if (!audience || audience === "all") return "everyone";
  const custom =
    rules.minOrderCount > 0 ||
    rules.maxOrderCount > 0 ||
    rules.minAov > 0 ||
    rules.maxAov > 0 ||
    rules.restaurantAffinity !== "any";
  if (custom) return "custom";
  if (rules.lifecycle === "new") return "new";
  if (rules.lifecycle === "returning") return "returning";
  if (rules.lifecycle === "lapsed") return "lapsed";
  return "custom";
}

function applyAudiencePreset(
  preset: AudiencePreset,
  rules: AdminOfferAudienceRules,
): Pick<FormState, "audience" | "audiencePreset" | "audienceRules"> {
  if (preset === "everyone") {
    return {
      audience: "all",
      audiencePreset: preset,
      audienceRules: { ...rules, lifecycle: "all" },
    };
  }
  const lifecycle: AudienceLifecycle =
    preset === "new" ? "new" : preset === "returning" ? "returning" : preset === "lapsed" ? "lapsed" : rules.lifecycle;
  return {
    audience: "segment",
    audiencePreset: preset,
    audienceRules: { ...rules, lifecycle },
  };
}

function comboLinePrice(item: ComboFormItem, dishes: OfferMenuItemOption[]): number {
  const dish = dishes.find((d) => d.id === item.menuItemId);
  if (dish) {
    if (item.variantName) {
      const v = dish.variants?.find((x) => x.name === item.variantName);
      if (v) return v.price;
    }
    return dish.price;
  }
  return item.unitPrice || 0;
}

function addOrIncrementComboItem(
  items: ComboFormItem[],
  dish: OfferMenuItemOption,
  variantName = "",
): ComboFormItem[] {
  const idx = items.findIndex(
    (c) => c.menuItemId === dish.id && (c.variantName || "") === variantName,
  );
  if (idx >= 0) {
    return items.map((c, i) => (i === idx ? { ...c, quantity: c.quantity + 1 } : c));
  }
  const unit = variantName
    ? dish.variants?.find((v) => v.name === variantName)?.price ?? dish.price
    : dish.price;
  return [
    ...items,
    {
      menuItemId: dish.id,
      quantity: 1,
      name: dish.name,
      variantName,
      unitPrice: unit,
    },
  ];
}

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
  buyVariantName: "",
  getVariantName: "",
  comboRestaurantId: "",
  comboItems: [],
  comboPrice: 0,
  fundingSource: "commission",
  fundingShareMode: "percent",
  commissionShare: 100,
  menuItemShare: 0,
  maxDistanceKm: 0,
  freeDeliveryFundingSource: "platform",
  freeDeliveryUnlock: "min_order",
  commissionCoverMultiplier: 2,
  audience: "all",
  audiencePreset: "everyone",
  audienceRules: defaultAudienceRules(),
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
    buyVariantName: row.buyVariantName || "",
    getVariantName: row.getVariantName || "",
    comboRestaurantId: row.comboRestaurantId || "",
    comboItems: row.comboItems.map((c) => ({
      menuItemId: c.menuItemId,
      quantity: c.quantity,
      name: c.name || "",
      variantName: c.variantName || "",
      unitPrice: 0,
    })),
    comboPrice: row.comboPrice,
    fundingSource: row.fundingSource,
    fundingShareMode: row.fundingShareMode,
    commissionShare: row.commissionShare,
    menuItemShare: row.menuItemShare,
    maxDistanceKm: row.maxDistanceKm || 0,
    freeDeliveryFundingSource: row.freeDeliveryFundingSource || "platform",
    freeDeliveryUnlock: row.freeDeliveryUnlock || "min_order",
    commissionCoverMultiplier: row.commissionCoverMultiplier || 2,
    audience: row.audience || "all",
    audiencePreset: audiencePresetFromOffer(row.audience, {
      ...defaultAudienceRules(),
      ...(row.audienceRules || {}),
    }),
    audienceRules: {
      ...defaultAudienceRules(),
      ...(row.audienceRules || {}),
    },
    startsAt: row.startsAt ? row.startsAt.slice(0, 16) : "",
    endsAt: row.endsAt ? row.endsAt.slice(0, 16) : "",
    autoApply: row.autoApply,
    sendPushOnPublish: row.sendPushOnPublish,
    publishNow: row.status === "active",
    usageLimit: row.usageLimit,
    usagePerUser: row.usagePerUser,
  };
}

function payloadFromForm(form: FormState, forecastSnapshot?: Record<string, unknown>) {
  return {
    ...form,
    restaurantIds: form.restaurantIds,
    menuItemIds: form.menuItemIds,
    buyMenuItemId: form.buyMenuItemId || null,
    getMenuItemId: form.getMenuItemId || null,
    comboRestaurantId: form.comboRestaurantId || null,
    comboItems: form.comboItems.map((c) => ({
      menuItemId: c.menuItemId,
      quantity: c.quantity,
      name: c.name,
      variantName: c.variantName || "",
    })),
    audience: form.audience,
    audienceRules: form.audienceRules,
    freeDeliveryUnlock: form.freeDeliveryUnlock,
    commissionCoverMultiplier: form.commissionCoverMultiplier,
    startsAt: form.startsAt || null,
    endsAt: form.endsAt || null,
    publishNow: form.publishNow,
    status: form.publishNow ? "active" : "draft",
    ...(forecastSnapshot ? { forecastSnapshot } : {}),
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
  const [previewAssumptions, setPreviewAssumptions] = useState({
    sampleCartAmount: 499,
    sampleDeliveryFee: 40,
    expectedOrderCount: 100,
  });
  const [debouncedPreviewKey, setDebouncedPreviewKey] = useState("");

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

  const previewPayload = useMemo(
    () => ({
      type: form.type,
      minOrderAmount: form.minOrderAmount,
      maxDiscountAmount: form.maxDiscountAmount,
      discountValue: form.discountValue,
      cashbackAmount: form.cashbackAmount,
      fundingSource: form.fundingSource,
      fundingShareMode: form.fundingShareMode,
      commissionShare: form.commissionShare,
      menuItemShare: form.menuItemShare,
      freeDeliveryFundingSource: form.freeDeliveryFundingSource,
      freeDeliveryUnlock: form.freeDeliveryUnlock,
      commissionCoverMultiplier: form.commissionCoverMultiplier,
      restaurantIds: form.restaurantIds,
      comboRestaurantId: form.comboRestaurantId || null,
      comboPrice: form.comboPrice,
      comboItems: form.comboItems.map((c) => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
        name: c.name,
        variantName: c.variantName || "",
      })),
      audience: form.audience,
      audienceRules: form.audienceRules,
      sampleCartAmount: previewAssumptions.sampleCartAmount,
      sampleDeliveryFee: previewAssumptions.sampleDeliveryFee,
      expectedOrderCount: previewAssumptions.expectedOrderCount,
    }),
    [form, previewAssumptions],
  );

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      setDebouncedPreviewKey(JSON.stringify(previewPayload));
    }, 350);
    return () => window.clearTimeout(t);
  }, [open, previewPayload]);

  const previewQuery = useQuery({
    queryKey: ["customer-offer-preview", debouncedPreviewKey],
    queryFn: () => previewCustomerOffer(JSON.parse(debouncedPreviewKey) as Record<string, unknown>),
    enabled: open && Boolean(debouncedPreviewKey),
    placeholderData: keepPreviousData,
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setPreviewAssumptions({
      sampleCartAmount: 499,
      sampleDeliveryFee: 40,
      expectedOrderCount: 100,
    });
    setOpen(true);
  }

  function openEdit(row: AdminCustomerOffer) {
    setEditingId(row.id);
    setForm(formFromOffer(row));
    setPreviewAssumptions({
      sampleCartAmount: Math.max(row.minOrderAmount || 0, 499),
      sampleDeliveryFee: 40,
      expectedOrderCount: 100,
    });
    setOpen(true);
  }

  function save() {
    const payload = payloadFromForm(form, previewQuery.data?.forecastSnapshot);
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
                    <TableHead>Audience</TableHead>
                    <TableHead>Live vs forecast</TableHead>
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
                        <div className="capitalize">
                          {row.audience === "segment"
                            ? row.audienceRules?.lifecycle || "segment"
                            : "Everyone"}
                        </div>
                        {row.maxDistanceKm > 0 && (
                          <div className="text-xs text-white/50">
                            ≤ {row.maxDistanceKm} km
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-white/80">
                        <div className="text-sm">
                          {row.liveMetrics?.redemptions ?? 0} uses ·{" "}
                          {row.liveMetrics?.uniqueUsers ?? 0} users
                        </div>
                        <div className="text-xs text-white/50">
                          Saved {inr(row.liveMetrics?.customerSavings)} · GMV{" "}
                          {inr(row.liveMetrics?.gmv)}
                        </div>
                        {row.forecastSnapshot ? (
                          <div className="text-xs text-white/45">
                            Forecast save {inr(row.forecastSnapshot.campaignCustomerSavings)} · cost{" "}
                            {inr(row.forecastSnapshot.campaignPlatformOfferCost)} vs actual{" "}
                            {inr(row.liveMetrics?.platformCost)}
                          </div>
                        ) : null}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#013644] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingId ? "Edit offer" : "Create offer"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-4">
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
                  onChange={(e) => {
                    const type = e.target.value as CustomerOfferType;
                    setForm({
                      ...form,
                      type,
                      fundingSource: type === "combo" ? "menu_item" : form.fundingSource,
                    });
                  }}
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

            <div className="space-y-2 rounded-md border border-white/10 p-3">
              <Label>Who sees this offer</Label>
              <select
                className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm text-white"
                value={form.audiencePreset}
                onChange={(e) => {
                  const preset = e.target.value as AudiencePreset;
                  setForm({ ...form, ...applyAudiencePreset(preset, form.audienceRules) });
                }}
              >
                <option className="bg-[#013644]" value="everyone">Everyone</option>
                <option className="bg-[#013644]" value="new">New customers (0 orders)</option>
                <option className="bg-[#013644]" value="returning">Returning customers</option>
                <option className="bg-[#013644]" value="lapsed">Lapsed customers</option>
                <option className="bg-[#013644]" value="custom">Custom segment</option>
              </select>
              {form.audiencePreset === "lapsed" && (
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
                          lapsedAfterDays: Number(e.target.value) || 30,
                        },
                      })
                    }
                  />
                </div>
              )}
              {form.audiencePreset === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Lifecycle</Label>
                    <select
                      className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm text-white"
                      value={form.audienceRules.lifecycle}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          audience: "segment",
                          audienceRules: {
                            ...form.audienceRules,
                            lifecycle: e.target.value as AudienceLifecycle,
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
                    <Label>Restaurant affinity</Label>
                    <select
                      className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm text-white"
                      value={form.audienceRules.restaurantAffinity}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          audienceRules: {
                            ...form.audienceRules,
                            restaurantAffinity: e.target.value as RestaurantAffinity,
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
                      value={form.audienceRules.minOrderCount}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          audienceRules: {
                            ...form.audienceRules,
                            minOrderCount: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Max orders (0 = none)</Label>
                    <Input
                      type="number"
                      value={form.audienceRules.maxOrderCount}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          audienceRules: {
                            ...form.audienceRules,
                            maxOrderCount: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Min AOV ₹</Label>
                    <Input
                      type="number"
                      value={form.audienceRules.minAov}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          audienceRules: {
                            ...form.audienceRules,
                            minAov: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Max AOV ₹ (0 = none)</Label>
                    <Input
                      type="number"
                      value={form.audienceRules.maxAov}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          audienceRules: {
                            ...form.audienceRules,
                            maxAov: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}
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
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Unlock when</Label>
                  <select
                    className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm text-white"
                    value={form.freeDeliveryUnlock}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        freeDeliveryUnlock: e.target.value as FreeDeliveryUnlock,
                      })
                    }
                  >
                    <option className="bg-[#013644]" value="min_order">
                      Min order amount
                    </option>
                    <option className="bg-[#013644]" value="commission_cover">
                      Commission covers delivery
                    </option>
                  </select>
                </div>
                {form.freeDeliveryUnlock === "min_order" ? (
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
                ) : (
                  <div className="grid gap-2">
                    <Label>Commission × delivery fee</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      step={0.5}
                      value={form.commissionCoverMultiplier}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          commissionCoverMultiplier: Number(e.target.value) || 2,
                        })
                      }
                    />
                    <p className="text-xs text-white/50">
                      Unlocks when restaurant commission ≥ this × delivery fee (e.g. 2×).
                    </p>
                  </div>
                )}
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
                  Buy item: {form.buyMenuItemId || "—"}
                  {form.buyVariantName ? ` (${form.buyVariantName})` : ""} · Get item:{" "}
                  {form.getMenuItemId || "same / pick"}
                  {form.getVariantName ? ` (${form.getVariantName})` : ""}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Buy variant (optional)</Label>
                    <Input
                      placeholder="Exact variant name"
                      value={form.buyVariantName}
                      onChange={(e) =>
                        setForm({ ...form, buyVariantName: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Get variant (optional)</Label>
                    <Input
                      placeholder="Exact variant name"
                      value={form.getVariantName}
                      onChange={(e) =>
                        setForm({ ...form, getVariantName: e.target.value })
                      }
                    />
                  </div>
                </div>
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
                    <div key={d.id} className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        className="rounded border border-white/20 px-2 py-1 text-xs text-white"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            comboItems: addOrIncrementComboItem(f.comboItems, d),
                          }))
                        }
                      >
                        + {d.name} ₹{d.price}
                      </button>
                      {(d.variants || []).map((v) => (
                        <button
                          key={`${d.id}-${v.name}`}
                          type="button"
                          className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/80"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              comboItems: addOrIncrementComboItem(f.comboItems, d, v.name),
                            }))
                          }
                        >
                          {v.name} ₹{v.price}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                <ul className="space-y-2 text-sm text-white/80">
                  {form.comboItems.map((c, idx) => {
                    const dish = dishOptions.find((d) => d.id === c.menuItemId);
                    const unit = comboLinePrice(c, dishOptions);
                    const lineTotal = unit * Math.max(1, c.quantity);
                    return (
                      <li
                        key={`${c.menuItemId}:${c.variantName}:${idx}`}
                        className="rounded border border-white/10 p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            {c.name || c.menuItemId}
                            {c.variantName ? ` · ${c.variantName}` : ""}
                          </span>
                          <button
                            type="button"
                            className="text-red-300"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                comboItems: f.comboItems.filter((_, i) => i !== idx),
                              }))
                            }
                          >
                            Remove
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="h-7 w-7 rounded border border-white/20 text-white"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                comboItems: f.comboItems.map((item, i) =>
                                  i === idx
                                    ? { ...item, quantity: Math.max(1, item.quantity - 1) }
                                    : item,
                                ),
                              }))
                            }
                          >
                            −
                          </button>
                          <Input
                            className="h-8 w-16"
                            type="number"
                            min={1}
                            value={c.quantity}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                comboItems: f.comboItems.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        quantity: Math.max(1, Number(e.target.value) || 1),
                                      }
                                    : item,
                                ),
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="h-7 w-7 rounded border border-white/20 text-white"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                comboItems: f.comboItems.map((item, i) =>
                                  i === idx ? { ...item, quantity: item.quantity + 1 } : item,
                                ),
                              }))
                            }
                          >
                            +
                          </button>
                          {(dish?.variants?.length ?? 0) > 0 && (
                            <select
                              className="h-8 rounded-md border border-white/15 bg-transparent px-2 text-xs text-white"
                              value={c.variantName}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  comboItems: f.comboItems.map((item, i) =>
                                    i === idx
                                      ? { ...item, variantName: e.target.value }
                                      : item,
                                  ),
                                }))
                              }
                            >
                              <option className="bg-[#013644]" value="">
                                Any variant
                              </option>
                              {dish?.variants?.map((v) => (
                                <option key={v.name} className="bg-[#013644]" value={v.name}>
                                  {v.name} ₹{v.price}
                                </option>
                              ))}
                            </select>
                          )}
                          <span className="ml-auto text-xs text-white/60">
                            {c.quantity} × {inr(unit)} = {inr(lineTotal)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {form.comboItems.length > 0 && (
                  <p className="text-xs text-white/60">
                    Catalog total{" "}
                    {inr(
                      form.comboItems.reduce(
                        (sum, c) => sum + comboLinePrice(c, dishOptions) * Math.max(1, c.quantity),
                        0,
                      ),
                    )}{" "}
                    vs combo {inr(form.comboPrice)}
                  </p>
                )}
                <div className="grid gap-2">
                  <Label>Combo offer price ₹</Label>
                  <Input
                    type="number"
                    value={form.comboPrice}
                    onChange={(e) =>
                      setForm({ ...form, comboPrice: Number(e.target.value) })
                    }
                  />
                  <p className="text-xs text-white/50">
                    Restaurant commission is taken on this combo selling price, not catalog.
                  </p>
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

            <div className="lg:sticky lg:top-0 lg:self-start">
              <OfferImpactPreviewPanel
                preview={previewQuery.data}
                loading={previewQuery.isFetching}
                error={previewQuery.isError}
                assumptions={previewAssumptions}
                onAssumptionsChange={(patch) =>
                  setPreviewAssumptions((prev) => ({ ...prev, ...patch }))
                }
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
