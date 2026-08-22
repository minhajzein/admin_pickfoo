import api from "@/lib/axios";

export type CommissionFreeDeliverySettings = {
  enabled: boolean;
  multiplier: number;
  title: string;
  subtitle: string;
  badgeLabel: string;
  updatedAt?: string | null;
};

export async function fetchCommissionFreeDeliverySettings(): Promise<CommissionFreeDeliverySettings> {
  const { data } = await api.get("/platform-promos/commission-free-delivery");
  return data.data as CommissionFreeDeliverySettings;
}

export async function updateCommissionFreeDeliverySettings(
  input: Partial<Omit<CommissionFreeDeliverySettings, "updatedAt">>,
): Promise<CommissionFreeDeliverySettings> {
  const { data } = await api.put("/platform-promos/commission-free-delivery", input);
  return data.data as CommissionFreeDeliverySettings;
}
