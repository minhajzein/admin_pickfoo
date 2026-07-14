import api from "@/lib/axios";

export interface AdminOrderRow {
  id: string;
  pickfooId?: string | null;
  status: string;
  orderType: "pickup" | "delivery" | string;
  /** Company commission only (not restaurant item totals). */
  platformCommission?: number | null;
  commissionPercent?: number | null;
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
}

export async function fetchDispatchOrders(params?: {
  limit?: number;
  status?: string;
}): Promise<AdminOrdersResponse> {
  const sp = new URLSearchParams();
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.status) sp.set("status", params.status);
  const q = sp.toString();
  const { data } = await api.get(`/dispatch/orders${q ? `?${q}` : ""}`);
  return {
    summary: {
      total: data.summary?.total ?? 0,
      active: data.summary?.active ?? 0,
      delivered: data.summary?.delivered ?? 0,
      cancelled: data.summary?.cancelled ?? 0,
      platformCommission: Number(data.summary?.platformCommission) || 0,
    },
    data: data.data ?? [],
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
  return (
    row.orderType === "pickup" &&
    (row.status === "preparing" || row.status === "ready")
  );
}

export { canRedispatchPickupOrder };
