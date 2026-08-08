import api from "@/lib/axios";

export type DeliveryChargeSettings = {
  minKm: number;
  ecoBaseFee: number;
  ecoPerKm: number;
  standardBaseFee: number;
  standardPerKm: number;
  expressAvailable: boolean;
  updatedAt?: string | null;
};

export async function fetchDeliveryCharges(): Promise<DeliveryChargeSettings> {
  const { data } = await api.get("/delivery-charges");
  return data.data as DeliveryChargeSettings;
}

export async function updateDeliveryCharges(
  input: Partial<Omit<DeliveryChargeSettings, "updatedAt">>,
): Promise<DeliveryChargeSettings> {
  const { data } = await api.put("/delivery-charges", input);
  return data.data as DeliveryChargeSettings;
}
