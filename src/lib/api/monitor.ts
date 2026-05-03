import api from "@/lib/axios";
import type { AdminMonitorEvent } from "@/types/models";

export async function fetchMonitorEvents(params?: {
  limit?: number;
  event?: string;
  source?: string;
}): Promise<AdminMonitorEvent[]> {
  const sp = new URLSearchParams();
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.event) sp.set("event", params.event);
  if (params?.source) sp.set("source", params.source);
  const query = sp.toString();
  const { data } = await api.get(`/monitor/events${query ? `?${query}` : ""}`);
  return data.data ?? [];
}

export async function clearMonitorEvents(): Promise<number> {
  const { data } = await api.delete("/monitor/events");
  return Number(data.deleted ?? 0);
}
