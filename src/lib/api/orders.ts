import api from "@/lib/axios";
import type { RefundSettlementPayload } from "@/lib/api/refund-settlement";

export interface AdminOrderRow {
  id: string;
  pickfooId?: string | null;
  status: string;
  paymentStatus?: "pending" | "paid" | "failed" | "refunded" | string | null;
  orderType: "pickup" | "delivery" | string;
  /** Grand total charged to the customer. */
  totalAmount?: number | null;
  /** Food subtotal (price × qty), excludes packing. */
  itemTotal?: number | null;
  /** Packing subtotal (packingCharge × qty). */
  packingTotal?: number | null;
  deliveryFee?: number | null;
  /** Full km/tier fee credited to partner (even when customer delivery is free). */
  partnerDeliveryFee?: number | null;
  customerDeliveryFee?: number | null;
  /** Company commission only (not restaurant item totals). */
  platformCommission?: number | null;
  commissionPercent?: number | null;
  preparingStartedAt?: string | null;
  restaurantId?: string | null;
  restaurantName?: string | null;
  assignedPartner?: string | null;
  partnerAssignedAt?: string | null;
  partnerDeliveryProgress?: string | null;
  deliveryAddress?: string | null;
  deliveryPartnerName?: string | null;
  deliveryPartnerPhone?: string | null;
  assignmentVersion?: number | null;
  rejectionReason?: string | null;
  rejectionCode?: string | null;
  createdAt: string;
}

export interface AdminOrdersResponse {
  summary: {
    total: number;
    active: number;
    delivered: number;
    cancelled: number;
    /** Sum of platform commission for active + delivered filtered orders. */
    platformCommission: number;
    /** Mean platform commission per active/delivered filtered order. */
    averageCommission: number;
    commissionableOrders: number;
  };
  data: AdminOrderRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function fetchDispatchOrders(params?: {
  limit?: number;
  page?: number;
  status?: string;
  restaurantId?: string;
  partnerId?: string;
  /** YYYY-MM-DD or ISO */
  from?: string;
  /** YYYY-MM-DD or ISO */
  to?: string;
}): Promise<AdminOrdersResponse> {
  const { data } = await api.get(`/dispatch/orders`, {
    params: {
      limit: params?.limit,
      page: params?.page,
      status: params?.status || undefined,
      restaurantId: params?.restaurantId || undefined,
      partnerId: params?.partnerId || undefined,
      from: params?.from || undefined,
      to: params?.to || undefined,
    },
  });
  const page = Number(data.page) || 1;
  const limit = Number(data.limit) || params?.limit || 25;
  const total = Number(data.total ?? data.summary?.total) || 0;
  return {
    summary: {
      total: data.summary?.total ?? total,
      active: data.summary?.active ?? 0,
      delivered: data.summary?.delivered ?? 0,
      cancelled: data.summary?.cancelled ?? 0,
      platformCommission: Number(data.summary?.platformCommission) || 0,
      averageCommission: Number(data.summary?.averageCommission) || 0,
      commissionableOrders: Number(data.summary?.commissionableOrders) || 0,
    },
    data: data.data ?? [],
    page,
    limit,
    total,
    totalPages:
      Number(data.totalPages) || Math.max(1, Math.ceil(total / limit) || 1),
  };
}

export interface AdminOrderItem {
  menuItem?: string | null;
  name: string;
  quantity: number;
  price: number;
  packingCharge: number;
  lineTotal: number;
}

export interface AdminOrderDetail {
  id: string;
  pickfooId?: string | null;
  status: string;
  orderType: string;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  paymentProvider?: string | null;
  razorpayOrderId?: string | null;
  paymentReference?: string | null;
  transactionId?: string | null;
  refundedAt?: string | null;
  refundReason?: string | null;
  items: AdminOrderItem[];
  itemTotal: number;
  packingTotal: number;
  deliveryFee: number;
  partnerDeliveryFee?: number;
  customerDeliveryFee?: number;
  discountAmount: number;
  tipAmount: number;
  taxableAmount?: number | null;
  sgstAmount: number;
  cgstAmount: number;
  gstAmount: number;
  restaurantGstRegistered: boolean;
  totalAmount?: number | null;
  platformCommission: number;
  commissionPercent: number;
  cookingRequests?: string | null;
  includeCutlery: boolean;
  deliveryTier?: string | null;
  deliveryInstructions?: string | null;
  voiceInstructionUrl?: string | null;
  addressImageUrl?: string | null;
  deliveryAddress?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  rejectionReason?: string | null;
  rejectionCode?: string | null;
  customer: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    profilePicture?: string | null;
  } | null;
  restaurant: {
    id?: string | null;
    name?: string | null;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    contactNumber?: string | null;
    email?: string | null;
    status?: string | null;
    image?: string | null;
    brandLogo?: string | null;
    commissionPercent: number;
  };
  deliveryPartner: {
    id: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    status?: string | null;
    isOnline: boolean;
    onDuty: boolean;
    profilePhoto?: string | null;
    assignedAt?: string | null;
    progress?: string | null;
    decision?: {
      status?: string | null;
      decidedAt?: string | null;
      reason?: string | null;
    } | null;
    locationUpdatedAt?: string | null;
  } | null;
  timeline: {
    orderDate?: string | null;
    createdAt?: string | null;
    acceptedForPaymentAt?: string | null;
    preparingStartedAt?: string | null;
    estimatedReadyAt?: string | null;
    readyAt?: string | null;
    updatedAt?: string | null;
  };
  assignmentVersion: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AdminOrderRoute {
  distanceKm: number;
  durationSeconds: number;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  provider: "osrm";
  computedAt: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  originSource: "order_snapshot" | "restaurant_profile";
}

export async function fetchDispatchOrder(
  orderRef: string
): Promise<AdminOrderDetail> {
  const { data } = await api.get(
    `/dispatch/orders/${encodeURIComponent(orderRef)}`
  );
  return data.data;
}

export async function fetchDispatchOrderRoute(
  orderRef: string,
): Promise<AdminOrderRoute> {
  const { data } = await api.get<{
    success: boolean;
    data?: AdminOrderRoute;
    message?: string;
  }>(`/dispatch/orders/${encodeURIComponent(orderRef)}/route`);
  if (!data.success || !data.data) {
    throw new Error(data.message || "Could not load the driving route");
  }
  return data.data;
}

export interface RedispatchOrderResponse {
  success: boolean;
  redispatched: boolean;
  reason?: string;
  clearedPreviousPartner?: boolean;
  partner?: {
    id: string;
    fullName: string;
    phone: string;
  };
}

export async function redispatchOrder(
  orderRef: string,
  reason?: string
): Promise<RedispatchOrderResponse> {
  const { data } = await api.post(`/dispatch/orders/${encodeURIComponent(orderRef)}/redispatch`, {
    reason: reason?.trim() || undefined,
  });
  return data;
}

export async function markOrderRefunded(
  orderRef: string,
  reason?: string,
  settlement?: RefundSettlementPayload,
): Promise<{
  success: boolean;
  data: {
    id: string;
    pickfooId?: string | null;
    paymentStatus: string;
    refundedAt: string;
    refundReason?: string | null;
    refundAmount?: number | null;
    walletDeductions?: {
      restaurantApplied: number;
      partnerApplied: number;
    } | null;
    transactionsUpdated: number;
  };
}> {
  const { data } = await api.post(
    `/dispatch/orders/${encodeURIComponent(orderRef)}/mark-refunded`,
    {
      reason: reason?.trim() || undefined,
      ...settlement,
    },
  );
  return data;
}

function canRedispatchPickupOrder(row: AdminOrderRow): boolean {
  if (row.orderType !== "pickup") return false;
  if (row.paymentStatus === "refunded") return false;
  if (row.status !== "preparing" && row.status !== "ready") return false;

  // Hide once a partner has accepted (or progressed further).
  const progress = row.partnerDeliveryProgress?.trim() || "";
  if (progress && progress !== "pending_accept") return false;

  return true;
}

/** Paid but restaurant has not started preparing yet. */
function isPaidAwaitingPrep(row: AdminOrderRow): boolean {
  return row.paymentStatus === "paid" && row.status === "confirmed";
}

/**
 * Who ended a rejected/cancelled request — shown under status in admin orders.
 * Matches restaurant / customer app labels.
 */
function cancelSourceLabel(input: {
  status?: string | null;
  rejectionCode?: string | null;
  rejectionReason?: string | null;
  refundReason?: string | null;
}): string | null {
  const status = (input.status ?? "").trim().toLowerCase();
  if (status === "payment-expired") return "Payment expired";
  if (status !== "rejected" && status !== "cancelled") return null;

  const refundDisplay = (() => {
    const raw = (
      input.refundReason ||
      input.rejectionReason ||
      ""
    ).trim();
    if (!raw) return "Refunded";
    const stripped = raw
      .replace(/^refunded by admin:\s*/i, "")
      .replace(/^refunded:\s*/i, "")
      .trim();
    return stripped || "Refunded";
  })();

  const code = (input.rejectionCode ?? "").trim().toLowerCase();
  switch (code) {
    case "payment_timeout":
      return "Payment expired";
    case "customer_cancelled":
      return "Canceled by customer";
    case "admin_refunded":
      return refundDisplay;
    case "owner_rejected":
      return "Canceled by restaurant";
    case "owner_not_responding":
      return "No response from restaurant";
    case "restaurant_closed":
    case "owner_unavailable":
    case "restaurant_not_accepting":
    case "item_not_active":
      return "Canceled by restaurant";
    default:
      break;
  }

  const reason = (input.rejectionReason ?? "").toLowerCase();
  if (
    reason.includes("canceled by customer") ||
    reason.includes("cancelled by customer") ||
    reason.includes("request canceled by customer")
  ) {
    return "Canceled by customer";
  }
  if (reason.includes("not responding")) {
    return "No response from restaurant";
  }
  if (reason.includes("refunded by admin") || reason.startsWith("refunded")) {
    return refundDisplay;
  }
  if ((input.rejectionReason ?? "").trim() || status === "rejected") {
    return "Canceled by restaurant";
  }
  return null;
}

export { canRedispatchPickupOrder, isPaidAwaitingPrep, cancelSourceLabel };
