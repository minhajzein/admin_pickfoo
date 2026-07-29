import api from "@/lib/axios";
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from "@/lib/pagination";
import type { AdminGig, AdminGigBooking, AdminGigStatus } from "@/types/models";

export async function fetchGigs(params?: {
  fromDayKey?: string;
  toDayKey?: string;
  status?: AdminGigStatus;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminGig>> {
  const { data } = await api.get(`/gigs`, {
    params: {
      fromDayKey: params?.fromDayKey || undefined,
      toDayKey: params?.toDayKey || undefined,
      status: params?.status || undefined,
      page: params?.page ?? 1,
      limit: params?.limit ?? DEFAULT_PAGE_SIZE,
    },
  });
  return parsePaginatedResponse<AdminGig>(data);
}

export async function createGig(input: {
  title: string;
  subtitle: string;
  dayKey: string;
  startMinute: number;
  endMinute: number;
  payoutPerOrder: number;
  maxOrders: number;
  bookingCutoffAt?: string;
}): Promise<AdminGig> {
  const { data } = await api.post("/gigs", input);
  return data.data as AdminGig;
}

export async function updateGig(
  id: string,
  patch: Partial<{
    title: string;
    subtitle: string;
    payoutPerOrder: number;
    maxOrders: number;
    status: AdminGigStatus;
    bookingCutoffAt: string | null;
  }>,
): Promise<AdminGig> {
  const { data } = await api.patch(`/gigs/${id}`, patch);
  return data.data as AdminGig;
}

export async function fetchGigBookings(id: string): Promise<{
  gig: AdminGig;
  bookings: AdminGigBooking[];
}> {
  const { data } = await api.get(`/gigs/${id}/bookings`);
  return {
    gig: data.gig as AdminGig,
    bookings: data.bookings as AdminGigBooking[],
  };
}
