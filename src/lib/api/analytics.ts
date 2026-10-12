import api from "@/lib/axios";

export type InsightItemBase = {
  menuItemId: string | null;
  name: string;
  restaurantId: string | null;
  restaurantName: string;
  categories: string[];
  price: number;
  isActive: boolean;
  rating: number | null;
  ratingCount: number;
};

export type InsightOrderedItem = InsightItemBase & {
  quantity: number;
  orders: number;
  revenue: number;
  cartUnits: number;
};

export type InsightCartItem = InsightItemBase & {
  adds: number;
  units: number;
  users: number;
  orderedUnits: number;
  conversion: number;
};

export type InsightRatedItem = InsightItemBase & {
  rating: number;
  fiveStar: number;
  lowStar: number;
};

export type InsightCategory = {
  category: string;
  quantity: number;
  revenue: number;
  orderLines: number;
  dishes: number;
  cartUnits: number;
};

export type InsightRestaurant = {
  restaurantId: string;
  name: string;
  isOpen: boolean;
  status: string;
  placed: number;
  completed: number;
  delivered: number;
  lost: number;
  lostRate: number;
  revenue: number;
  avgOrderValue: number;
  customers: number;
  rating: number;
  numReviews: number;
  periodRating: number | null;
  periodReviews: number;
  topItem: { name: string; quantity: number } | null;
};

export type InsightTotals = {
  orders: number;
  revenue: number;
  discount: number;
  avgOrderValue: number;
  unitsSold: number;
  customers: number;
  repeatCustomers: number;
  placedOrders: number;
  lostOrders: number;
  lostRate: number;
  cartAddEvents: number;
  cartUnits: number;
  cartUsers: number;
  cartToOrderRate: number;
  reviews: number;
  itemRatings: number;
  avgRestaurantRating: number | null;
  avgDeliveryRating: number | null;
};

export type Insights = {
  from: string;
  to: string;
  restaurant: {
    id: string;
    name: string;
    isOpen: boolean;
    status: string;
    rating: number;
    numReviews: number;
  } | null;
  totals: InsightTotals;
  daily: Array<{ date: string; orders: number; revenue: number }>;
  hourly: Array<{ hour: number; orders: number; revenue: number }>;
  weekdays: Array<{ day: string; orders: number; revenue: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  orderTypes: Array<{ type: string; orders: number }>;
  topOrderedItems: InsightOrderedItem[];
  topRevenueItems: InsightOrderedItem[];
  topCartItems: InsightCartItem[];
  mostAbandonedItems: InsightCartItem[];
  topCategories: InsightCategory[];
  topRatedItems: InsightRatedItem[];
  lowestRatedItems: InsightRatedItem[];
  mostReviewedItems: InsightRatedItem[];
  restaurants: InsightRestaurant[];
};

export async function fetchInsights(params: {
  from?: string;
  to?: string;
  restaurantId?: string;
}): Promise<Insights> {
  const { data } = await api.get<{ success?: boolean; data: Insights }>(
    "/analytics/insights",
    {
      params: {
        from: params.from || undefined,
        to: params.to || undefined,
        restaurantId: params.restaurantId || undefined,
      },
    },
  );
  return data.data;
}

export type LiveAppUser = {
  id: string;
  userId: string | null;
  name: string;
  phone: string;
  isGuest: boolean;
  platform: string;
  appVersion: string;
  lat: number | null;
  lng: number | null;
  locationSource: "device" | "browse" | null;
  locationLabel: string;
  locationUpdatedAt: string | null;
  lastSeenAt: string;
  sessionStartedAt: string | null;
};

export type LiveUsersFeed = {
  refreshedAt: string;
  windowMinutes: number;
  summary: {
    online: number;
    loggedIn: number;
    guests: number;
    withLocation: number;
    withDeviceLocation: number;
    android: number;
    ios: number;
    activeToday: number;
    activeLast7Days: number;
    installs: number;
  };
  users: LiveAppUser[];
};

export async function fetchLiveUsers(windowMinutes = 3): Promise<LiveUsersFeed> {
  const { data } = await api.get<{ success?: boolean; data: LiveUsersFeed }>(
    "/analytics/live-users",
    { params: { windowMinutes } },
  );
  return data.data;
}
