import api from "@/lib/axios";

export type DashboardDailyPoint = {
  date: string;
  orders: number;
  revenue: number;
};

export type DashboardRestaurantStat = {
  restaurantId: string | null;
  name: string;
  orders: number;
  revenue: number;
  share?: number;
};

export type DashboardAnalytics = {
  from: string;
  to: string;
  totals: { orders: number; revenue: number };
  daily: DashboardDailyPoint[];
  byRestaurant: DashboardRestaurantStat[];
  revenueShare: DashboardRestaurantStat[];
  leaderboard: DashboardRestaurantStat[];
};

export async function fetchDashboardAnalytics(params?: {
  from?: string;
  to?: string;
}): Promise<DashboardAnalytics> {
  const res = await api.get<{ success?: boolean; data?: DashboardAnalytics }>(
    "/dispatch/analytics",
    { params },
  );
  const data = res.data?.data;
  if (!data) {
    return {
      from: params?.from ?? "",
      to: params?.to ?? "",
      totals: { orders: 0, revenue: 0 },
      daily: [],
      byRestaurant: [],
      revenueShare: [],
      leaderboard: [],
    };
  }
  return data;
}
