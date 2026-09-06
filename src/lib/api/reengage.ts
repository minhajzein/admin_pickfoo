import api from "@/lib/axios";
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from "@/lib/pagination";

export type PushCategory =
  | "meal_breakfast"
  | "meal_lunch"
  | "meal_tea"
  | "meal_dinner"
  | "restaurant_open"
  | "winback_never_ordered"
  | "winback_lapsed";

export interface PushCopyRow {
  id: string;
  key: string;
  category: PushCategory | string;
  variantGroup: "A" | "B" | string;
  titleTemplate: string;
  bodyTemplate: string;
  weight: number;
  isActive: boolean;
}

export interface PushAnalyticsRow {
  category: string;
  variantKey: string;
  variantGroup: string;
  sent: number;
  opened: number;
  converted: number;
  openRate: number;
  conversionRate: number;
}

export interface ReengageSettings {
  timezone: string;
  slotWindows: Record<string, { start: string; end: string }>;
  quietHours: { start: string; end: string };
  maxPerDay: number;
  maxPerDayWithEvent: number;
  lapsedAfterDays: number;
  nearbyKm: number;
  skipIfOrderedToday: boolean;
  enabled: boolean;
}

export async function fetchPushCopy(params?: {
  page?: number;
  limit?: number;
  category?: string;
}): Promise<PaginatedResult<PushCopyRow>> {
  const { data } = await api.get("/reengage/copy", {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? DEFAULT_PAGE_SIZE,
      category: params?.category || undefined,
    },
  });
  return parsePaginatedResponse<PushCopyRow>(data);
}

export async function createPushCopy(input: Partial<PushCopyRow>): Promise<PushCopyRow> {
  const { data } = await api.post("/reengage/copy", input);
  return data.data as PushCopyRow;
}

export async function updatePushCopy(
  id: string,
  patch: Partial<PushCopyRow>,
): Promise<PushCopyRow> {
  const { data } = await api.patch(`/reengage/copy/${id}`, patch);
  return data.data as PushCopyRow;
}

export async function fetchReengageSettings(): Promise<ReengageSettings> {
  const { data } = await api.get("/reengage/settings");
  return data.data as ReengageSettings;
}

export async function updateReengageSettings(
  patch: Partial<ReengageSettings>,
): Promise<ReengageSettings> {
  const { data } = await api.patch("/reengage/settings", patch);
  return data.data as ReengageSettings;
}

export async function fetchReengageAnalytics(): Promise<PushAnalyticsRow[]> {
  const { data } = await api.get("/reengage/analytics");
  return (data.data || []) as PushAnalyticsRow[];
}
