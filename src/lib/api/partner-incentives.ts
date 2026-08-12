import api from "@/lib/axios";
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from "@/lib/pagination";
import type {
  AdminPartnerIncentive,
  AdminPartnerIncentiveProgress,
  PartnerIncentiveAudience,
  PartnerIncentiveConditions,
  PartnerIncentiveStatus,
  PartnerIncentiveType,
} from "@/types/models";

export async function fetchPartnerIncentives(params?: {
  status?: PartnerIncentiveStatus;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminPartnerIncentive>> {
  const { data } = await api.get(`/partner-incentives`, {
    params: {
      status: params?.status || undefined,
      page: params?.page ?? 1,
      limit: params?.limit ?? DEFAULT_PAGE_SIZE,
    },
  });
  return parsePaginatedResponse<AdminPartnerIncentive>(data);
}

export async function createPartnerIncentive(input: {
  title: string;
  body: string;
  type: PartnerIncentiveType;
  rewardAmountInr: number;
  rewardMode?: "flat" | "guaranteed_total";
  startsAt: string;
  endsAt: string;
  streakTarget?: number;
  dailyTarget?: number;
  requireMinDeliveries?: number;
  conditions?: PartnerIncentiveConditions & {
    enableAcceptRate?: boolean;
    enableOnlineHours?: boolean;
    enableOnlineShift?: boolean;
    enableMinDeliveries?: boolean;
  };
  audience: PartnerIncentiveAudience;
  zoneIds?: string[];
  partnerIds?: string[];
  publishNow?: boolean;
  status?: "draft" | "scheduled";
}): Promise<AdminPartnerIncentive> {
  const { data } = await api.post("/partner-incentives", input);
  return data.data as AdminPartnerIncentive;
}

export async function updatePartnerIncentive(
  id: string,
  patch: Partial<{
    title: string;
    body: string;
    rewardAmountInr: number;
    status: PartnerIncentiveStatus;
    startsAt: string;
    endsAt: string;
  }>,
): Promise<AdminPartnerIncentive> {
  const { data } = await api.patch(`/partner-incentives/${id}`, patch);
  return data.data as AdminPartnerIncentive;
}

export async function activatePartnerIncentive(
  id: string,
): Promise<AdminPartnerIncentive> {
  const { data } = await api.post(`/partner-incentives/${id}/activate`);
  return data.data as AdminPartnerIncentive;
}

export async function fetchPartnerIncentiveProgress(
  id: string,
  params?: { status?: string; page?: number; limit?: number },
): Promise<PaginatedResult<AdminPartnerIncentiveProgress>> {
  const { data } = await api.get(`/partner-incentives/${id}/progress`, {
    params: {
      status: params?.status || undefined,
      page: params?.page ?? 1,
      limit: params?.limit ?? 50,
    },
  });
  return parsePaginatedResponse<AdminPartnerIncentiveProgress>(data);
}
