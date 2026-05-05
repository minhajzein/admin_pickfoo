import api from "@/lib/axios";
import type { AdminGig, AdminGigBooking, AdminGigStatus } from "@/types/models";

export async function fetchGigs(params?: {
  fromDayKey?: string;
  toDayKey?: string;
  status?: AdminGigStatus;
}): Promise<AdminGig[]> {
  const sp = new URLSearchParams();
  if (params?.fromDayKey) sp.set("fromDayKey", params.fromDayKey);
  if (params?.toDayKey) sp.set("toDayKey", params.toDayKey);
  if (params?.status) sp.set("status", params.status);
  const q = sp.toString();
  const { data } = await api.get(`/gigs${q ? `?${q}` : ""}`);
  return data.data as AdminGig[];
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
