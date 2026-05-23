import api from "@/lib/axios";

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
  title: string;
  subtitle: string;
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
  const { data } = await api.post("/banners", input);
  return data.data as AdminHomeBanner;
}

export async function updateBanner(
  id: string,
  patch: Partial<{
    title: string;
    subtitle: string;
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
  const { data } = await api.patch(`/banners/${id}`, patch);
  return data.data as AdminHomeBanner;
}

export async function deleteBanner(id: string): Promise<void> {
  await api.delete(`/banners/${id}`);
}

export async function uploadBannerImage(file: File): Promise<{
  fileUrl: string;
  staticUrl: string;
}> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/banners/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return {
    fileUrl: data.data.fileUrl as string,
    staticUrl: data.data.staticUrl as string,
  };
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
