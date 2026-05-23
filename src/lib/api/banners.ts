import axios from "axios";
import api from "@/lib/axios";
import { uploadSupportMedia } from "@/lib/api/support";

export type HomeBannerLinkType = "none" | "restaurant" | "dish" | "dishes";

export interface AdminHomeBanner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  imageStaticUrl: string;
  linkType: HomeBannerLinkType;
  restaurantId: string | null;
  menuItemId: string | null;
  menuItemIds: string[];
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BannerRestaurantOption {
  id: string;
  name: string;
  city: string;
  image: string;
}

export interface BannerMenuItemOption {
  id: string;
  name: string;
  image: string;
  price: number;
  restaurantIds: string[];
}

export async function fetchBanners(): Promise<AdminHomeBanner[]> {
  const { data } = await api.get("/banners");
  return data.data as AdminHomeBanner[];
}

export async function createBanner(input: {
  title?: string;
  subtitle?: string;
  imageStaticUrl: string;
  linkType: HomeBannerLinkType;
  restaurantId?: string | null;
  menuItemId?: string | null;
  menuItemIds?: string[];
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}): Promise<AdminHomeBanner> {
  const { data } = await api.post<{
    success: boolean;
    data?: AdminHomeBanner;
    message?: string;
  }>("/banners", input);
  if (!data.success || !data.data) {
    throw new Error(data.message || "Failed to create banner");
  }
  return data.data;
}

export async function updateBanner(
  id: string,
  patch: Partial<{
    title?: string;
    subtitle?: string;
    imageStaticUrl: string;
    linkType: HomeBannerLinkType;
    restaurantId: string | null;
    menuItemId: string | null;
    menuItemIds: string[];
    sortOrder: number;
    isActive: boolean;
    startsAt: string | null;
    endsAt: string | null;
  }>,
): Promise<AdminHomeBanner> {
  const { data } = await api.patch<{
    success: boolean;
    data?: AdminHomeBanner;
    message?: string;
  }>(`/banners/${id}`, patch);
  if (!data.success || !data.data) {
    throw new Error(data.message || "Failed to update banner");
  }
  return data.data;
}

export async function deleteBanner(id: string): Promise<void> {
  await api.delete(`/banners/${id}`);
}

type UploadPayload = { fileUrl: string; staticUrl: string };

async function postMultipartUpload(url: string, file: File): Promise<UploadPayload> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{
    success: boolean;
    data?: { fileUrl?: string; staticUrl?: string };
    message?: string;
  }>(url, form, {
    timeout: 120_000,
    // Let axios set multipart boundary — manual Content-Type breaks multer parsing.
    transformRequest: [
      (body, headers) => {
        if (body instanceof FormData) {
          delete headers["Content-Type"];
        }
        return body;
      },
    ],
  });
  if (!data.success || !data.data?.staticUrl) {
    throw new Error(data.message || "Upload failed");
  }
  const staticUrl = data.data.staticUrl;
  return {
    staticUrl,
    fileUrl: data.data.fileUrl || staticUrl,
  };
}

/** Upload banner image to S3 (home-banners/). Falls back to support upload if route missing. */
export async function uploadBannerImage(file: File): Promise<UploadPayload> {
  try {
    return await postMultipartUpload("/banners/upload", file);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      const fallback = await uploadSupportMedia(file);
      if (fallback.messageType === "image" || !fallback.messageType) {
        return {
          staticUrl: fallback.staticUrl,
          fileUrl: fallback.fileUrl || fallback.staticUrl,
        };
      }
      throw new Error("Only image files are allowed for banners");
    }
    if (axios.isAxiosError(error)) {
      const msg =
        typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : error.message;
      throw new Error(msg || "Upload failed");
    }
    if (error instanceof Error) throw error;
    throw new Error("Upload failed");
  }
}

export async function searchBannerRestaurants(
  search: string,
): Promise<BannerRestaurantOption[]> {
  const sp = new URLSearchParams();
  if (search.trim()) sp.set("search", search.trim());
  // Use main restaurants API (same as Restaurants page) — reliable in all deployments.
  const { data } = await api.get(`/restaurants?${sp}`);
  const rows = (data.data ?? []) as Array<{
    _id: string;
    name: string;
    image?: string;
    address?: { city?: string };
  }>;
  return rows.slice(0, 25).map((r) => ({
    id: r._id,
    name: r.name,
    city: r.address?.city ?? "",
    image: r.image ?? "",
  }));
}

export async function searchBannerMenuItems(params: {
  search: string;
  restaurantId?: string;
}): Promise<BannerMenuItemOption[]> {
  const sp = new URLSearchParams();
  if (params.search.trim()) sp.set("search", params.search.trim());
  if (params.restaurantId) sp.set("restaurantId", params.restaurantId);
  sp.set("limit", "30");
  const { data } = await api.get(`/banners/link-options/menu-items?${sp}`);
  return data.data as BannerMenuItemOption[];
}
