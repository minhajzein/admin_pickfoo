import api from "@/lib/axios";
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from "@/lib/pagination";
import type { Partner } from "@/types/models";

export async function fetchPartners(params?: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<Partner>> {
  const { data } = await api.get(`/partners`, {
    params: {
      status: params?.status || undefined,
      search: params?.search?.trim() || undefined,
      page: params?.page ?? 1,
      limit: params?.limit ?? DEFAULT_PAGE_SIZE,
    },
  });
  return parsePaginatedResponse<Partner>(data);
}

export async function fetchPartner(partnerId: string): Promise<Partner> {
  const { data } = await api.get(`/partners/${partnerId}`);
  return data.data;
}

export async function updatePartnerZones(
  partnerId: string,
  zoneIds: string[],
): Promise<Partner> {
  const { data } = await api.patch(`/partners/${partnerId}/zones`, { zoneIds });
  return data.data;
}

export async function updatePartnerPriorityLevel(
  partnerId: string,
  priorityLevel: number,
): Promise<Partner> {
  const { data } = await api.patch(`/partners/${partnerId}/priority-level`, {
    priorityLevel,
  });
  return data.data;
}

export async function updatePartnerDetails(
  partnerId: string,
  payload: {
    fullName?: string;
    phone?: string;
    email?: string;
  },
): Promise<Partner> {
  const { data } = await api.patch(`/partners/${partnerId}/details`, payload);
  return data.data;
}

export async function fetchPartnerVerifications(params?: {
  status?: string;
  search?: string;
}): Promise<Partner[]> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.search) sp.set("search", params.search);
  const q = sp.toString();
  const { data } = await api.get(`/partners/verifications${q ? `?${q}` : ""}`);
  return data.data;
}

export async function verifyPartner(
  partnerId: string,
  payload: { action: "approve" | "reject"; reason?: string },
): Promise<Partner> {
  const { data } = await api.patch(`/partners/${partnerId}/verify`, payload);
  return data.data;
}

export type SecurityDepositAction =
  | "mark_office_paid"
  | "mark_refund_eligible"
  | "mark_refunded"
  | "mark_forfeited";

export async function updatePartnerSecurityDeposit(
  partnerId: string,
  action: SecurityDepositAction,
): Promise<Partner> {
  const { data } = await api.patch(`/partners/${partnerId}/security-deposit`, {
    action,
  });
  return data.data;
}
