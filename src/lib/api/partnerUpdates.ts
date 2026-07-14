import api from "@/lib/axios";

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
  limit?: number;
}): Promise<AdminPartnerUpdate[]> {
  const sp = new URLSearchParams();
  if (params?.source) sp.set("source", params.source);
  if (params?.limit) sp.set("limit", String(params.limit));
  const q = sp.toString();
  const { data } = await api.get(`/partner-updates${q ? `?${q}` : ""}`);
  return data.data as AdminPartnerUpdate[];
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
