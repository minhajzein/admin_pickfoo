import api, { getApiErrorMessage } from "@/lib/axios";
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

export async function updateRestaurantCommission(
  restaurantId: string,
  commissionPercent: number,
): Promise<Restaurant> {
  const { data } = await api.patch(`/restaurants/${restaurantId}/commission`, {
    commissionPercent,
  });
  return data.data;
}

export async function updateRestaurantPayoutMode(
  restaurantId: string,
  payoutMode: "manual" | "auto",
): Promise<Restaurant> {
  const { data } = await api.patch(`/restaurants/${restaurantId}/payout-mode`, {
    payoutMode,
  });
  return data.data;
}

export type RestaurantProfileUpdate = {
  name?: string;
  description?: string;
  contactNumber?: string;
  brandLogo?: string;
  image?: string;
};

export async function updateRestaurantProfile(
  restaurantId: string,
  payload: RestaurantProfileUpdate,
): Promise<Restaurant> {
  const { data } = await api.patch(`/restaurants/${restaurantId}/profile`, payload);
  return data.data;
}

export async function updateRestaurantAvailability(
  restaurantId: string,
  payload: { isOpen: boolean } | { resetOverride: true },
): Promise<Restaurant> {
  const { data } = await api.patch(
    `/restaurants/${restaurantId}/availability`,
    payload,
  );
  return data.data;
}

export type RestaurantImageUpload = {
  fileUrl: string;
  staticUrl: string;
};

export async function uploadRestaurantImage(
  file: File,
  folder: "restaurants" | "restaurants/logos" = "restaurants",
): Promise<RestaurantImageUpload> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  try {
    const { data } = await api.post<{
      success: boolean;
      data?: { fileUrl?: string; staticUrl?: string };
      message?: string;
    }>("/restaurants/upload", form, {
      timeout: 120_000,
    });
    if (!data.success || !(data.data?.staticUrl || data.data?.fileUrl)) {
      throw new Error(data.message || "Upload failed");
    }
    const staticUrl = data.data.staticUrl ?? data.data.fileUrl!;
    return {
      fileUrl: data.data.fileUrl || staticUrl,
      staticUrl,
    };
  } catch (err) {
    throw new Error(getApiErrorMessage(err, "Upload failed"));
  }
}
