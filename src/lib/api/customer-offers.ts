import api from "@/lib/axios";
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from "@/lib/pagination";
import type { AdminCustomerOffer, CustomerOfferStatus } from "@/types/models";

export type OfferRestaurantOption = {
  id: string;
  name: string;
  city: string;
  image: string;
};

export type OfferMenuItemOption = {
  id: string;
  name: string;
  image: string;
  price: number;
  restaurantIds: string[];
};

export async function fetchCustomerOffers(params?: {
  status?: CustomerOfferStatus;
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminCustomerOffer>> {
  const { data } = await api.get("/customer-offers", {
    params: {
      status: params?.status || undefined,
      type: params?.type || undefined,
      search: params?.search || undefined,
      page: params?.page ?? 1,
      limit: params?.limit ?? DEFAULT_PAGE_SIZE,
    },
  });
  return parsePaginatedResponse<AdminCustomerOffer>(data);
}

export async function createCustomerOffer(
  input: Record<string, unknown>,
): Promise<AdminCustomerOffer> {
  const { data } = await api.post("/customer-offers", input);
  return data.data as AdminCustomerOffer;
}

export async function updateCustomerOffer(
  id: string,
  patch: Record<string, unknown>,
): Promise<AdminCustomerOffer> {
  const { data } = await api.patch(`/customer-offers/${id}`, patch);
  return data.data as AdminCustomerOffer;
}

export async function activateCustomerOffer(id: string, resendPush = false) {
  const { data } = await api.post(`/customer-offers/${id}/activate`, {
    resendPush,
  });
  return data.data as AdminCustomerOffer;
}

export async function deleteCustomerOffer(id: string) {
  await api.delete(`/customer-offers/${id}`);
}

export async function searchOfferRestaurants(search: string) {
  const { data } = await api.get("/customer-offers/link-options/restaurants", {
    params: { search, limit: 20 },
  });
  return (data.data ?? []) as OfferRestaurantOption[];
}

export async function searchOfferMenuItems(params: {
  search?: string;
  restaurantId?: string;
}) {
  const { data } = await api.get("/customer-offers/link-options/menu-items", {
    params: {
      search: params.search || undefined,
      restaurantId: params.restaurantId || undefined,
      limit: 30,
    },
  });
  return (data.data ?? []) as OfferMenuItemOption[];
}
