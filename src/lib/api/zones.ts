import api from "@/lib/axios";
import type { DeliveryZone, ZoneGeometry } from "@/types/models";

export async function fetchZones(params?: {
  district?: string;
  includeInactive?: boolean;
}): Promise<DeliveryZone[]> {
  const sp = new URLSearchParams();
  if (params?.district) sp.set("district", params.district);
  if (params?.includeInactive) sp.set("includeInactive", "true");
  const q = sp.toString();
  const { data } = await api.get(`/zones${q ? `?${q}` : ""}`);
  return data.data;
}

export async function createZone(body: {
  name: string;
  code: string;
  district?: string;
  geometry: ZoneGeometry;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<DeliveryZone> {
  const { data } = await api.post("/zones", body);
  return data.data;
}

export async function updateZone(
  id: string,
  body: Partial<{
    name: string;
    code: string;
    district: string;
    geometry: ZoneGeometry;
    color: string;
    sortOrder: number;
    isActive: boolean;
  }>,
): Promise<DeliveryZone> {
  const { data } = await api.put(`/zones/${id}`, body);
  return data.data;
}

export async function deleteZone(id: string): Promise<void> {
  await api.delete(`/zones/${id}`);
}

export async function suggestZoneForPoint(body: {
  lat: number;
  lng: number;
  district?: string;
}): Promise<{
  matches: { _id: string; name: string; code: string }[];
  primary: { _id: string; name: string; code: string } | null;
}> {
  const { data } = await api.post("/zones/suggest-for-point", body);
  return data.data;
}
