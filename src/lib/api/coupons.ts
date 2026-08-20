import api from "@/lib/axios";
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from "@/lib/pagination";

export type CouponKind = "coupon" | "voucher";

export interface AdminCoupon {
  id: string;
  code: string;
  kind: CouponKind;
  title: string;
  description: string;
  offerId: string;
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
}

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

export async function createCoupon(input: {
  code: string;
  kind: CouponKind;
  title: string;
  description?: string;
  offerId: string;
  isActive?: boolean;
  usageLimit?: number;
  usagePerUser?: number;
  startsAt?: string | null;
  endsAt?: string | null;
}): Promise<AdminCoupon> {
  const { data } = await api.post("/coupons", input);
  return data.data as AdminCoupon;
}

export async function updateCoupon(
  id: string,
  patch: Partial<{
    code: string;
    kind: CouponKind;
    title: string;
    description: string;
    offerId: string;
    isActive: boolean;
    usageLimit: number;
    usagePerUser: number;
    startsAt: string | null;
    endsAt: string | null;
  }>,
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
