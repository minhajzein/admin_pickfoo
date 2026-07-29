import api from "@/lib/axios";
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from "@/lib/pagination";

export type PartnerUpdateCategory = "payment" | "payout" | "offer" | "bonus";
export type PartnerUpdateAudience = "all" | "zones" | "partners";
export type PartnerUpdateSource = "admin" | "system";

export type AdminPartnerUpdate = {
  id: string;
  title: string;
  body: string;
  category: PartnerUpdateCategory;
  source: PartnerUpdateSource;
  audience: PartnerUpdateAudience;
  zoneIds: string[];
  partnerIds: string[];
  meta: Record<string, unknown> | null;
  publishedAt: string;
  createdByAdminId: string | null;
  createdAt: string;
};

export async function fetchPartnerUpdates(params?: {
  source?: PartnerUpdateSource;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminPartnerUpdate>> {
  const { data } = await api.get(`/partner-updates`, {
    params: {
      source: params?.source || undefined,
      page: params?.page ?? 1,
      limit: params?.limit ?? DEFAULT_PAGE_SIZE,
    },
  });
  return parsePaginatedResponse<AdminPartnerUpdate>(data);
}

export async function createPartnerUpdate(input: {
  title: string;
  body: string;
  category: PartnerUpdateCategory;
  audience?: PartnerUpdateAudience;
  zoneIds?: string[];
  partnerIds?: string[];
}): Promise<AdminPartnerUpdate> {
  const { data } = await api.post("/partner-updates", input);
  return data.data as AdminPartnerUpdate;
}

export async function deletePartnerUpdate(id: string): Promise<void> {
  await api.delete(`/partner-updates/${id}`);
}
