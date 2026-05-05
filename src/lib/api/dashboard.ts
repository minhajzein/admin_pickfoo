import api from "@/lib/axios";
import type { AdminMonitorEvent, Partner, Restaurant, User } from "@/types/models";

interface ApiListResponse<T> {
  data?: T[];
}

interface DispatchOrdersResponse {
  summary?: {
    total?: number;
    active?: number;
    delivered?: number;
    cancelled?: number;
  };
  data?: Array<{
    id: string;
    pickfooId?: string | null;
    status: string;
    orderType: "pickup" | "delivery" | string;
    totalAmount?: number | null;
    createdAt: string;
  }>;
}

export interface DashboardActivity {
  id: string;
  event: string;
  message: string;
  source?: string;
  createdAt: string;
}

export interface DashboardVerificationItem {
  id: string;
  name: string;
  city?: string;
  createdAt: string;
}

export interface DashboardOverview {
  totalRestaurants: number;
  pendingRestaurantVerifications: number;
  activeUsers: number;
  totalOrders: number;
  grossRevenue: number;
  onlinePartners: number;
  recentActivity: DashboardActivity[];
  verificationQueue: DashboardVerificationItem[];
}

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const [restaurantsRes, usersRes, partnersRes, monitorRes, ordersRes] = await Promise.all([
    api.get<ApiListResponse<Restaurant>>("/restaurants"),
    api.get<ApiListResponse<User>>("/users"),
    api.get<ApiListResponse<Partner>>("/partners"),
    api.get<ApiListResponse<AdminMonitorEvent>>("/monitor/events?limit=120"),
    api.get<DispatchOrdersResponse>("/dispatch/orders?limit=300"),
  ]);

  const restaurants = restaurantsRes.data?.data ?? [];
  const users = usersRes.data?.data ?? [];
  const partners = partnersRes.data?.data ?? [];
  const events = monitorRes.data?.data ?? [];
  const orders = ordersRes.data?.data ?? [];
  const orderSummary = ordersRes.data?.summary;

  const pendingRestaurants = restaurants.filter((restaurant) => {
    return restaurant.status === "pending";
  });
  const activeUsers = users.filter((user) => {
    return user.role === "user" && user.isVerified;
  }).length;
  const onlinePartners = partners.filter((partner) => partner.isOnline).length;

  const grossRevenue = orders.reduce((sum, order) => {
    const amount = asNumber(order.totalAmount);
    return sum + (amount || 0);
  }, 0);

  return {
    totalRestaurants: restaurants.length,
    pendingRestaurantVerifications: pendingRestaurants.length,
    activeUsers,
    totalOrders: orderSummary?.total ?? orders.length,
    grossRevenue,
    onlinePartners,
    recentActivity: events.slice(0, 6).map((event) => ({
      id: event.id,
      event: event.event,
      message: describeMonitorEvent(event),
      source: event.source,
      createdAt: event.createdAt,
    })),
    verificationQueue: pendingRestaurants.slice(0, 5).map((restaurant) => ({
      id: String(restaurant._id ?? ""),
      name: restaurant.name,
      city: restaurant.address?.city,
      createdAt: restaurant.createdAt ?? new Date().toISOString(),
    })),
  };
}

function describeMonitorEvent(event: AdminMonitorEvent): string {
  const payload = asObject(event.payload);
  switch (event.event) {
    case "new-restaurant-verification":
      return asString(payload.message) || "New restaurant requested verification";
    case "dispatch:partner-assigned": {
      const partner = asString(payload.partnerName) || "Partner";
      const orderRef =
        asString(payload.pickfooId) || asString(payload.orderId) || "order";
      return `${partner} assigned to ${orderRef}`;
    }
    case "dispatch:no-partner-available":
      return `${asString(payload.orderRef) || "Order"} has no partner available`;
    case "order:live:new-request": {
      const orderRef = asString(payload.orderId) || "New order";
      const amount = asNumber(payload.totalAmount);
      return amount ? `${orderRef} placed for ₹${amount}` : `${orderRef} placed`;
    }
    case "order:live:status-updated":
      return `${asString(payload.orderId) || "Order"} status changed to ${
        asString(payload.status) || "updated"
      }`;
    case "order:live:customer-cancelled":
      return `${asString(payload.orderId) || "Order"} cancelled by customer`;
    default:
      return event.event.replace(/:/g, " ");
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
