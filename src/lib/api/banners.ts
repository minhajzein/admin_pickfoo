import axios from "axios";
import api, { getApiErrorMessage } from "@/lib/axios";
import { uploadSupportMedia } from "@/lib/api/support";
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from "@/lib/pagination";

export type HomeBannerLinkType = "none" | "restaurant" | "dish" | "dishes" | "offer";

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
  offerId: string | null;
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

export interface BannerOfferOption {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  status: string;
  badgeLabel: string;
}

export interface BannerMenuItemOption {
  id: string;
  name: string;
  image: string;
  price: number;
  restaurantIds: string[];
}

export async function fetchBanners(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminHomeBanner>> {
  const { data } = await api.get("/banners", {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? DEFAULT_PAGE_SIZE,
    },
  });
  const parsed = parsePaginatedResponse<AdminHomeBanner & { _id?: string }>(data);
  return {
    ...parsed,
    data: parsed.data
      .map((row) => ({
        ...row,
        id: String(row.id ?? row._id ?? "").trim(),
        menuItemIds: row.menuItemIds ?? [],
      }))
      .filter((row) => row.id.length > 0),
  };
}

export async function createBanner(input: {
  title?: string;
  subtitle?: string;
  imageStaticUrl: string;
  linkType: HomeBannerLinkType;
  restaurantId?: string | null;
  menuItemId?: string | null;
  menuItemIds?: string[];
  offerId?: string | null;
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
    offerId: string | null;
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
    if (axios.isAxiosError(error) && error.response?.status === 413) {
      throw new Error(
        "Image file is too large for the server (max 50 MB). Ask ops to set nginx client_max_body_size to 50m and redeploy admin-api.",
      );
    }
    throw new Error(getApiErrorMessage(error, "Upload failed"));
  }
}

export async function searchBannerRestaurants(
  search: string,
  opts?: { ids?: string[] },
): Promise<BannerRestaurantOption[]> {
  const sp = new URLSearchParams();
  if (search.trim()) sp.set("search", search.trim());
  if (opts?.ids?.length) sp.set("ids", opts.ids.filter(Boolean).join(","));
  sp.set("limit", "25");
  const { data } = await api.get(`/banners/link-options/restaurants?${sp}`);
  const rows = (data.data ?? []) as Array<{
    id?: string;
    _id?: string;
    name: string;
    city?: string;
    image?: string;
  }>;
  return rows
    .map((r) => ({
      id: String(r.id ?? r._id ?? "").trim(),
      name: r.name,
      city: r.city ?? "",
      image: r.image ?? "",
    }))
    .filter((r) => r.id.length > 0);
}

export async function searchBannerOffers(
  search: string,
): Promise<BannerOfferOption[]> {
  const sp = new URLSearchParams();
  if (search.trim()) sp.set("search", search.trim());
  sp.set("limit", "25");
  const { data } = await api.get(`/banners/link-options/offers?${sp}`);
  return data.data as BannerOfferOption[];
}

export async function searchBannerMenuItems(params: {
  search?: string;
  restaurantId?: string;
  ids?: string[];
}): Promise<BannerMenuItemOption[]> {
  const sp = new URLSearchParams();
  if (params.search?.trim()) sp.set("search", params.search.trim());
  if (params.restaurantId) sp.set("restaurantId", params.restaurantId);
  if (params.ids?.length) sp.set("ids", params.ids.filter(Boolean).join(","));
  sp.set("limit", "30");
  const { data } = await api.get(`/banners/link-options/menu-items?${sp}`);
  const rows = (data.data ?? []) as Array<{
    id?: string;
    _id?: string;
    name: string;
    image?: string;
    price?: number;
    restaurantIds?: string[];
  }>;
  return rows
    .map((item) => ({
      id: String(item.id ?? item._id ?? "").trim(),
      name: item.name,
      image: item.image ?? "",
      price: item.price ?? 0,
      restaurantIds: item.restaurantIds ?? [],
    }))
    .filter((item) => item.id.length > 0);
}
