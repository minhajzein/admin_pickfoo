import api from "@/lib/axios";
import type { Partner } from "@/types/models";

export async function fetchPartners(params?: {
  status?: string;
  search?: string;
}): Promise<Partner[]> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.search) sp.set("search", params.search);
  const q = sp.toString();
  const { data } = await api.get(`/partners${q ? `?${q}` : ""}`);
  return data.data;
}

export async function updatePartnerZones(
  partnerId: string,
  zoneIds: string[],
): Promise<Partner> {
  const { data } = await api.patch(`/partners/${partnerId}/zones`, { zoneIds });
  return data.data;
}
