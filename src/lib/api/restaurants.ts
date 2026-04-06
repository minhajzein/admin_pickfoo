import api from "@/lib/axios";
import type { Restaurant } from "@/types/models";

export async function updateRestaurantZone(
  restaurantId: string,
  zoneId: string | null,
): Promise<Restaurant> {
  const { data } = await api.patch(`/restaurants/${restaurantId}/zone`, {
    zoneId: zoneId === null ? null : zoneId,
  });
  return data.data;
}
