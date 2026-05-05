import api from "@/lib/axios";

export interface AdminOrderRow {
  id: string;
  pickfooId?: string | null;
  status: string;
  orderType: "pickup" | "delivery" | string;
  totalAmount?: number | null;
  assignedPartner?: string | null;
  partnerAssignedAt?: string | null;
  createdAt: string;
}

export interface AdminOrdersResponse {
  summary: {
    total: number;
    active: number;
    delivered: number;
    cancelled: number;
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
    summary: data.summary ?? {
      total: 0,
      active: 0,
      delivered: 0,
      cancelled: 0,
    },
    data: data.data ?? [],
  };
}
