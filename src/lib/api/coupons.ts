import api from "@/lib/axios";
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from "@/lib/pagination";

export type CouponKind = "coupon" | "voucher";
export type CouponScope = "all" | "restaurants" | "items" | "categories";

export interface AdminCoupon {
  id: string;
  code: string;
  kind: CouponKind;
  title: string;
  description: string;
  offerId: string;
  offerTitle?: string;
  scope: CouponScope;
  restaurantIds: string[];
  menuItemIds: string[];
  categoryNames: string[];
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  usageLimit: number;
  usagePerUser: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CouponOfferOption {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  status: string;
  scope?: string;
}

export interface CouponRestaurantOption {
  id: string;
  name: string;
  city: string;
  image: string;
}

export interface CouponMenuItemOption {
  id: string;
  name: string;
  image: string;
  price: number;
  category: string;
  restaurantIds: string[];
}

export interface CouponCategoryOption {
  id: string;
  name: string;
  image: string;
}

export type CouponPayload = {
  code: string;
  kind: CouponKind;
  title: string;
  description?: string;
  offerId: string;
  scope?: CouponScope;
  restaurantIds?: string[];
  menuItemIds?: string[];
  categoryNames?: string[];
  isActive?: boolean;
  usageLimit?: number;
  usagePerUser?: number;
  startsAt?: string | null;
  endsAt?: string | null;
};

export async function fetchCoupons(params?: {
  page?: number;
  limit?: number;
  kind?: CouponKind;
  search?: string;
}): Promise<PaginatedResult<AdminCoupon>> {
  const { data } = await api.get("/coupons", {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? DEFAULT_PAGE_SIZE,
      kind: params?.kind,
      search: params?.search?.trim() || undefined,
    },
  });
  return parsePaginatedResponse<AdminCoupon>(data);
}

export async function createCoupon(input: CouponPayload): Promise<AdminCoupon> {
  const { data } = await api.post("/coupons", input);
  return data.data as AdminCoupon;
}

export async function updateCoupon(
  id: string,
  patch: Partial<CouponPayload>,
): Promise<AdminCoupon> {
  const { data } = await api.patch(`/coupons/${id}`, patch);
  return data.data as AdminCoupon;
}

export async function deleteCoupon(id: string): Promise<void> {
  await api.delete(`/coupons/${id}`);
}

export async function searchCouponOffers(search: string): Promise<CouponOfferOption[]> {
  const sp = new URLSearchParams();
  if (search.trim()) sp.set("search", search.trim());
  sp.set("limit", "25");
  const { data } = await api.get(`/coupons/link-options/offers?${sp}`);
  return data.data as CouponOfferOption[];
}

export async function searchCouponRestaurants(search: string): Promise<CouponRestaurantOption[]> {
  const sp = new URLSearchParams();
  if (search.trim()) sp.set("search", search.trim());
  sp.set("limit", "25");
  const { data } = await api.get(`/coupons/link-options/restaurants?${sp}`);
  return data.data as CouponRestaurantOption[];
}

export async function searchCouponMenuItems(params?: {
  search?: string;
  restaurantId?: string;
}): Promise<CouponMenuItemOption[]> {
  const sp = new URLSearchParams();
  if (params?.search?.trim()) sp.set("search", params.search.trim());
  if (params?.restaurantId) sp.set("restaurantId", params.restaurantId);
  sp.set("limit", "30");
  const { data } = await api.get(`/coupons/link-options/menu-items?${sp}`);
  return data.data as CouponMenuItemOption[];
}

export async function searchCouponCategories(search: string): Promise<CouponCategoryOption[]> {
  const sp = new URLSearchParams();
  if (search.trim()) sp.set("search", search.trim());
  sp.set("limit", "30");
  const { data } = await api.get(`/coupons/link-options/categories?${sp}`);
  return data.data as CouponCategoryOption[];
}
