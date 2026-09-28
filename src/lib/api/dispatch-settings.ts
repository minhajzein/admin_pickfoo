import api from "@/lib/axios";

export type DispatchPeakMode = "off" | "auto" | "always";

export type DispatchSettings = {
  batchingEnabled: boolean;
  allowSameRestaurant: boolean;
  allowCrossRestaurant: boolean;
  allowOnRoute: boolean;
  allowSameCustomer: boolean;
  autoSplitDelayed: boolean;
  maxOrdersPerPartner: number;
  maxRestaurantDistanceKm: number;
  maxDropDistanceKm: number;
  maxSingleOrderKm: number;
  maxCombinedRouteKm: number;
  maxFirstOrderExtraMinutes: number;
  maxPrepGapMinutes: number;
  firstOrderLateAfterMinutes: number;
  restaurantOverloadOpenOrders: number;
  restaurantOverloadLateOrders: number;
  peakMode: DispatchPeakMode;
  peakFreeRiderThreshold: number;
  peakHours: string;
  secondOrderPayoutPercent: number;
  updatedAt?: string | null;
};

export async function fetchDispatchSettings(): Promise<DispatchSettings> {
  const { data } = await api.get("/dispatch-settings");
  return data.data as DispatchSettings;
}

export async function updateDispatchSettings(
  input: Partial<Omit<DispatchSettings, "updatedAt">>,
): Promise<DispatchSettings> {
  const { data } = await api.put("/dispatch-settings", input);
  return data.data as DispatchSettings;
}
