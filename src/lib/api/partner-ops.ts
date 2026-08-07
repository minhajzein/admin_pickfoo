import api from "@/lib/axios";
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from "@/lib/pagination";

export interface PartnerPresenceDay {
  dayKey: string;
  onlineSeconds: number;
  onDutySeconds: number;
}

export interface PartnerPresenceHours {
  partner: {
    id: string;
    fullName: string;
    phone?: string | null;
    isOnline: boolean;
    onDuty: boolean;
  };
  today: PartnerPresenceDay;
  days: PartnerPresenceDay[];
  totals: {
    onlineSeconds: number;
    onDutySeconds: number;
  };
}

export type PartnerOpsOrderScope =
  | "completed"
  | "missed"
  | "rejected"
  | "active"
  | "all";

export interface PartnerOpsOrder {
  id: string;
  pickfooId?: string | null;
  status?: string | null;
  orderType?: string | null;
  restaurantName?: string | null;
  totalAmount?: number | null;
  deliveryFee?: number | null;
  partnerDeliveryProgress?: string | null;
  partnerAssignedAt?: string | null;
  partnerDecision?: {
    status?: string | null;
    decidedAt?: string | null;
    reason?: string | null;
  } | null;
  outcome: "completed" | "missed" | "rejected" | "active" | "other";
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PartnerOpsOrdersResponse
  extends PaginatedResult<PartnerOpsOrder> {
  summary: {
    completed: number;
    missed: number;
    rejected: number;
    active: number;
    deliveredOrderCount: number;
  };
}

export async function fetchPartnerPresenceHours(
  partnerId: string,
  days = 14
): Promise<PartnerPresenceHours> {
  const { data } = await api.get(`/partners/${partnerId}/presence-hours`, {
    params: { days },
  });
  return data.data;
}

export async function fetchPartnerOpsOrders(
  partnerId: string,
  params?: {
    scope?: PartnerOpsOrderScope;
    page?: number;
    limit?: number;
  }
): Promise<PartnerOpsOrdersResponse> {
  const { data } = await api.get(`/partners/${partnerId}/orders`, {
    params: {
      scope: params?.scope ?? "completed",
      page: params?.page ?? 1,
      limit: params?.limit ?? DEFAULT_PAGE_SIZE,
    },
  });
  const page = parsePaginatedResponse<PartnerOpsOrder>(data);
  return {
    ...page,
    summary: {
      completed: Number(data.summary?.completed) || 0,
      missed: Number(data.summary?.missed) || 0,
      rejected: Number(data.summary?.rejected) || 0,
      active: Number(data.summary?.active) || 0,
      deliveredOrderCount: Number(data.summary?.deliveredOrderCount) || 0,
    },
  };
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}
