import api from "@/lib/axios";
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from "@/lib/pagination";
import type { AdminCustomerOffer, CustomerOfferStatus } from "@/types/models";

export type OfferRestaurantOption = {
  id: string;
  name: string;
  city: string;
  image: string;
};

export type OfferMenuItemOption = {
  id: string;
  name: string;
  image: string;
  price: number;
  restaurantIds: string[];
};

export type OfferPreviewPerOrder = {
  cartAmount: number;
  discountAmount: number;
  cashbackAmount: number;
  deliveryFeeCharged: number;
  deliveryFeeWaived: number;
  customerPays: number;
  customerSaves: number;
  fundingLabel:
    | "platform-funded"
    | "restaurant-funded"
    | "shared-funded"
    | "cashback-only"
    | "none";
  commissionBeforeOffer: number;
  commissionAfterOffer: number;
  restaurantGrossBeforeOffer: number;
  restaurantGrossAfterOffer: number;
  restaurantNet: number;
  platformCommissionRetained: number;
  platformOfferCost: number;
  platformNet: number;
  platformProfitLoss: "profit" | "breakeven" | "loss";
  offerFunding: {
    commission: number;
    menuItem: number;
    platformDelivery: number;
    restaurantDelivery: number;
  };
};

export type OfferPreviewScenario = {
  key: "bestCase" | "expectedCase" | "worstCase";
  label: string;
  description: string;
  conversionRate: number;
  orderCount: number;
  perOrder: OfferPreviewPerOrder;
  campaignPlatformNet: number;
  campaignRestaurantNet: number;
  campaignCustomerSavings: number;
  campaignPlatformOfferCost: number;
};

export type OfferPreviewResult = {
  restaurant: {
    id: string;
    name: string | null;
    commissionPercent: number;
    gstRegistered: boolean;
  } | null;
  assumptions: {
    sampleCartAmount: number;
    sampleDeliveryFee: number;
    packingAmount: number;
    commissionPercent: number;
    gstRegistered: boolean;
    gstRatePercent: number;
    tipAmount: number;
    expectedOrderCount: number;
  };
  fundingLabel: OfferPreviewPerOrder["fundingLabel"];
  perOrder: OfferPreviewPerOrder;
  scenarios: OfferPreviewScenario[];
  purchaseChance: {
    score: "high" | "medium" | "low";
    scorePercent: number;
    explainers: string[];
    sampleSize: number;
    avgOrderValue: number;
    deliveredOrderCount: number;
  };
  riskSummary: {
    platformProfitLoss: "profit" | "breakeven" | "loss";
    expectedCampaignPlatformNet: number;
    expectedCampaignPlatformCost: number;
    note: string;
  };
  analyticsFollowUp?: {
    supported: boolean;
    message: string;
  };
};

export async function fetchCustomerOffers(params?: {
  status?: CustomerOfferStatus;
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminCustomerOffer>> {
  const { data } = await api.get("/customer-offers", {
    params: {
      status: params?.status || undefined,
      type: params?.type || undefined,
      search: params?.search || undefined,
      page: params?.page ?? 1,
      limit: params?.limit ?? DEFAULT_PAGE_SIZE,
    },
  });
  return parsePaginatedResponse<AdminCustomerOffer>(data);
}

export async function createCustomerOffer(
  input: Record<string, unknown>,
): Promise<AdminCustomerOffer> {
  const { data } = await api.post("/customer-offers", input);
  return data.data as AdminCustomerOffer;
}

export async function updateCustomerOffer(
  id: string,
  patch: Record<string, unknown>,
): Promise<AdminCustomerOffer> {
  const { data } = await api.patch(`/customer-offers/${id}`, patch);
  return data.data as AdminCustomerOffer;
}

export async function activateCustomerOffer(id: string, resendPush = false) {
  const { data } = await api.post(`/customer-offers/${id}/activate`, {
    resendPush,
  });
  return data.data as AdminCustomerOffer;
}

export async function deleteCustomerOffer(id: string) {
  await api.delete(`/customer-offers/${id}`);
}

export async function searchOfferRestaurants(search: string) {
  const { data } = await api.get("/customer-offers/link-options/restaurants", {
    params: { search, limit: 20 },
  });
  return (data.data ?? []) as OfferRestaurantOption[];
}

export async function searchOfferMenuItems(params: {
  search?: string;
  restaurantId?: string;
}) {
  const { data } = await api.get("/customer-offers/link-options/menu-items", {
    params: {
      search: params.search || undefined,
      restaurantId: params.restaurantId || undefined,
      limit: 30,
    },
  });
  return (data.data ?? []) as OfferMenuItemOption[];
}

export async function previewCustomerOffer(
  input: Record<string, unknown>,
): Promise<OfferPreviewResult> {
  const { data } = await api.post("/customer-offers/preview", input);
  return data.data as OfferPreviewResult;
}
