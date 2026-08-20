import axios from "axios";
import api, { getApiErrorMessage } from "@/lib/axios";
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from "@/lib/pagination";

export type HomeVideoLinkType =
  | "none"
  | "restaurant"
  | "dish"
  | "dishes"
  | "category"
  | "offer";

export interface AdminHomeVideo {
  id: string;
  title: string;
  videoUrl: string;
  videoStaticUrl: string;
  storageKey?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  durationSec?: number;
  linkType: HomeVideoLinkType;
  restaurantId: string | null;
  menuItemId: string | null;
  menuItemIds: string[];
  categoryId: string | null;
  categoryName: string;
  offerId: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface HomeVideoRestaurantOption {
  id: string;
  name: string;
  city: string;
  image: string;
}

export interface HomeVideoMenuItemOption {
  id: string;
  name: string;
  image: string;
  price: number;
  restaurantIds: string[];
}

export interface HomeVideoOfferOption {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  status: string;
  badgeLabel: string;
}

export interface HomeVideoCategoryOption {
  id: string;
  name: string;
  image: string;
}

export type HomeVideoUploadResult = {
  fileUrl: string;
  staticUrl: string;
  storageKey?: string;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSec?: number;
};

export const HOME_VIDEO_MAX_MB = 20;
export const HOME_VIDEO_MAX_DURATION_SEC = 30;
export const HOME_VIDEO_TARGET_RATIO = 4;
export const HOME_VIDEO_RATIO_TOLERANCE = 0.08;

export async function fetchHomeVideos(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminHomeVideo>> {
  const { data } = await api.get("/home-videos", {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? DEFAULT_PAGE_SIZE,
    },
  });
  const parsed = parsePaginatedResponse<AdminHomeVideo & { _id?: string }>(data);
  return {
    ...parsed,
    data: parsed.data
      .map((row) => ({
        ...row,
        id: String(row.id ?? row._id ?? "").trim(),
        menuItemIds: row.menuItemIds ?? [],
        categoryId: row.categoryId ?? null,
        categoryName: row.categoryName ?? "",
      }))
      .filter((row) => row.id.length > 0),
  };
}

export async function createHomeVideo(input: {
  title?: string;
  videoStaticUrl: string;
  storageKey?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  durationSec?: number;
  linkType: HomeVideoLinkType;
  restaurantId?: string | null;
  menuItemId?: string | null;
  menuItemIds?: string[];
  categoryId?: string | null;
  offerId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}): Promise<AdminHomeVideo> {
  const { data } = await api.post<{
    success: boolean;
    data?: AdminHomeVideo;
    message?: string;
  }>("/home-videos", input);
  if (!data.success || !data.data) {
    throw new Error(data.message || "Failed to create home video");
  }
  return data.data;
}

export async function updateHomeVideo(
  id: string,
  patch: Partial<{
    title?: string;
    videoStaticUrl: string;
    storageKey?: string;
    mimeType?: string;
    fileSize?: number;
    width?: number;
    height?: number;
    durationSec?: number;
    linkType: HomeVideoLinkType;
    restaurantId: string | null;
    menuItemId: string | null;
    menuItemIds: string[];
    categoryId: string | null;
    offerId: string | null;
    sortOrder: number;
    isActive: boolean;
    startsAt: string | null;
    endsAt: string | null;
  }>,
): Promise<AdminHomeVideo> {
  const { data } = await api.patch<{
    success: boolean;
    data?: AdminHomeVideo;
    message?: string;
  }>(`/home-videos/${id}`, patch);
  if (!data.success || !data.data) {
    throw new Error(data.message || "Failed to update home video");
  }
  return data.data;
}

export async function deleteHomeVideo(id: string): Promise<void> {
  await api.delete(`/home-videos/${id}`);
}

/** Client-side preflight before upload (backend still authoritative). */
export async function validateHomeVideoFile(file: File): Promise<void> {
  const maxBytes = HOME_VIDEO_MAX_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(
      `Video too large (max ${HOME_VIDEO_MAX_MB} MB). Compress to a short landscape 4:1 MP4.`,
    );
  }
  const name = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();
  if (!name.endsWith(".mp4") && mime !== "video/mp4" && mime !== "application/mp4") {
    throw new Error("Only MP4 videos are allowed.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const meta = await new Promise<{ width: number; height: number; duration: number }>(
      (resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          resolve({
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
          });
          video.removeAttribute("src");
          video.load();
        };
        video.onerror = () => reject(new Error("Could not read video metadata."));
        video.src = objectUrl;
      },
    );

    if (!Number.isFinite(meta.duration) || meta.duration <= 0) {
      throw new Error("Could not determine video duration.");
    }
    if (meta.duration > HOME_VIDEO_MAX_DURATION_SEC + 0.25) {
      throw new Error(
        `Video is too long (max ${HOME_VIDEO_MAX_DURATION_SEC}s). Got ${meta.duration.toFixed(1)}s.`,
      );
    }
    if (!meta.width || !meta.height) {
      throw new Error("Could not determine video dimensions.");
    }
    if (meta.width <= meta.height) {
      throw new Error(
        `Video must be landscape (wider than tall). Got ${meta.width}x${meta.height}.`,
      );
    }
    const ratio = meta.width / meta.height;
    const delta =
      Math.abs(ratio - HOME_VIDEO_TARGET_RATIO) / HOME_VIDEO_TARGET_RATIO;
    if (delta > HOME_VIDEO_RATIO_TOLERANCE) {
      throw new Error(
        `Video must be landscape ~4:1 (very wide). Got ${meta.width}x${meta.height} (~${ratio.toFixed(2)}:1).`,
      );
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadHomeVideo(file: File): Promise<HomeVideoUploadResult> {
  await validateHomeVideoFile(file);
  const form = new FormData();
  form.append("file", file);
  try {
    const { data } = await api.post<{
      success: boolean;
      data?: HomeVideoUploadResult;
      message?: string;
    }>("/home-videos/upload", form, {
      timeout: 180_000,
    });
    if (!data.success || !data.data?.staticUrl) {
      throw new Error(data.message || "Upload failed");
    }
    return {
      ...data.data,
      fileUrl: data.data.fileUrl || data.data.staticUrl,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 413) {
      throw new Error(
        `Video is too large for the server (max ${HOME_VIDEO_MAX_MB} MB). Ask ops to keep nginx client_max_body_size at 50m.`,
      );
    }
    throw new Error(getApiErrorMessage(error, "Upload failed"));
  }
}

export async function searchHomeVideoRestaurants(
  search: string,
): Promise<HomeVideoRestaurantOption[]> {
  const sp = new URLSearchParams();
  if (search.trim()) sp.set("search", search.trim());
  sp.set("limit", "25");
  const { data } = await api.get(`/home-videos/link-options/restaurants?${sp}`);
  return data.data as HomeVideoRestaurantOption[];
}

export async function searchHomeVideoMenuItems(params: {
  search: string;
  restaurantId?: string;
}): Promise<HomeVideoMenuItemOption[]> {
  const sp = new URLSearchParams();
  if (params.search.trim()) sp.set("search", params.search.trim());
  if (params.restaurantId) sp.set("restaurantId", params.restaurantId);
  sp.set("limit", "30");
  const { data } = await api.get(`/home-videos/link-options/menu-items?${sp}`);
  return data.data as HomeVideoMenuItemOption[];
}

export async function searchHomeVideoCategories(
  search: string,
): Promise<HomeVideoCategoryOption[]> {
  const sp = new URLSearchParams();
  if (search.trim()) sp.set("search", search.trim());
  sp.set("limit", "30");
  const { data } = await api.get(`/home-videos/link-options/categories?${sp}`);
  return data.data as HomeVideoCategoryOption[];
}

export async function searchHomeVideoOffers(
  search: string,
): Promise<HomeVideoOfferOption[]> {
  const sp = new URLSearchParams();
  if (search.trim()) sp.set("search", search.trim());
  sp.set("limit", "25");
  const { data } = await api.get(`/home-videos/link-options/offers?${sp}`);
  return data.data as HomeVideoOfferOption[];
}
