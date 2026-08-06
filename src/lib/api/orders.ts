import api from "@/lib/axios";

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
  createdAt: string;
}

export interface AdminOrdersResponse {
  summary: {
    total: number;
    active: number;
    delivered: number;
    cancelled: number;
    /** Sum of platform commission for non-cancelled/rejected rows in the result set. */
    platformCommission: number;
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
}): Promise<AdminOrdersResponse> {
  const { data } = await api.get(`/dispatch/orders`, {
    params: {
      limit: params?.limit,
      page: params?.page,
      status: params?.status || undefined,
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
    },
    data: data.data ?? [],
    page,
    limit,
    total,
    totalPages:
      Number(data.totalPages) || Math.max(1, Math.ceil(total / limit) || 1),
  };
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

function canRedispatchPickupOrder(row: AdminOrderRow): boolean {
  if (row.orderType !== "pickup") return false;
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

export { canRedispatchPickupOrder, isPaidAwaitingPrep };
