import api from "@/lib/axios";

export interface LiveMapPartnerMarker {
  id: string;
  fullName: string;
  phone: string;
  isOnline: boolean;
  onDuty: boolean;
  priorityLevel: number;
  lng: number;
  lat: number;
  zones: Array<{ id: string; name: string; code: string; color?: string }>;
}

export interface LiveMapRestaurantMarker {
  id: string;
  name: string;
  status: string;
  isOpen: boolean;
  lng: number;
  lat: number;
  zone?: { id: string; name: string; code: string; color?: string } | null;
}

export interface LiveMapPartnerWithoutLocation {
  id: string;
  fullName: string;
  phone: string;
  isOnline: boolean;
  onDuty: boolean;
}

export interface LiveMapFeed {
  refreshedAt: string;
  summary: {
    partnersOnline: number;
    partnersOnDuty: number;
    partnersMapped: number;
    partnersMissingLocation: number;
    restaurantsMapped: number;
    restaurantsMissingLocation: number;
    restaurantsOpen: number;
    restaurantsClosed: number;
  };
  partners: LiveMapPartnerMarker[];
  partnersWithoutLocation: LiveMapPartnerWithoutLocation[];
  restaurants: LiveMapRestaurantMarker[];
}

export async function fetchLiveMapFeed(params?: {
  onlineOnly?: boolean;
  activeRestaurantsOnly?: boolean;
}): Promise<LiveMapFeed> {
  const sp = new URLSearchParams();
  if (params?.onlineOnly === false) sp.set("onlineOnly", "false");
  if (params?.activeRestaurantsOnly === false) {
    sp.set("activeRestaurantsOnly", "false");
  }
  const q = sp.toString();
  const { data } = await api.get(`/map/live${q ? `?${q}` : ""}`);
  return {
    refreshedAt: data.refreshedAt,
    summary: {
      partnersOnline: data.summary?.partnersOnline ?? 0,
      partnersOnDuty: data.summary?.partnersOnDuty ?? 0,
      partnersMapped: data.summary?.partnersMapped ?? 0,
      partnersMissingLocation: data.summary?.partnersMissingLocation ?? 0,
      restaurantsMapped: data.summary?.restaurantsMapped ?? 0,
      restaurantsMissingLocation: data.summary?.restaurantsMissingLocation ?? 0,
      restaurantsOpen: data.summary?.restaurantsOpen ?? 0,
      restaurantsClosed: data.summary?.restaurantsClosed ?? 0,
    },
    partners: data.partners,
    partnersWithoutLocation: data.partnersWithoutLocation ?? [],
    restaurants: data.restaurants,
  };
}
