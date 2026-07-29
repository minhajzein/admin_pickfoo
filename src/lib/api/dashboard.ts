import api from "@/lib/axios";
import type { AdminMonitorEvent, Partner, Restaurant, User } from "@/types/models";
import { fetchDispatchOrders } from "@/lib/api/orders";
import { fetchPartners } from "@/lib/api/partners";
import { parsePaginatedResponse } from "@/lib/pagination";

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
  /** Platform / company commission income only. */
  platformCommission: number;
  onlinePartners: number;
  recentActivity: DashboardActivity[];
  verificationQueue: DashboardVerificationItem[];
}

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const [restaurantsRes, pendingRes, usersRes, partnersResult, monitorRes, ordersRes] =
    await Promise.all([
      api.get("/restaurants", { params: { page: 1, limit: 1 } }),
      api.get("/restaurants", {
        params: { page: 1, limit: 5, status: "pending" },
      }),
      api.get("/users", { params: { role: "user", page: 1, limit: 1 } }),
      fetchPartners({ page: 1, limit: 100 }),
      api.get<{ data?: AdminMonitorEvent[] }>("/monitor/events?limit=120"),
      fetchDispatchOrders({ page: 1, limit: 300 }),
    ]);

  const restaurantsMeta = parsePaginatedResponse<Restaurant>(restaurantsRes.data);
  const pendingMeta = parsePaginatedResponse<Restaurant>(pendingRes.data);
  const usersMeta = parsePaginatedResponse<User>(usersRes.data);
  const partners = partnersResult.data ?? [];
  const events = monitorRes.data?.data ?? [];
  const orders = ordersRes.data ?? [];
  const orderSummary = ordersRes.summary;

  const onlinePartners = partners.filter((partner: Partner) => partner.isOnline)
    .length;

  return {
    totalRestaurants: restaurantsMeta.total,
    pendingRestaurantVerifications: pendingMeta.total,
    activeUsers: usersMeta.total,
    totalOrders: orderSummary?.total ?? orders.length,
    platformCommission: orderSummary?.platformCommission ?? 0,
    onlinePartners,
    recentActivity: events.slice(0, 6).map((event) => ({
      id: event.id,
      event: event.event,
      message: describeMonitorEvent(event),
      source: event.source,
      createdAt: event.createdAt,
    })),
    verificationQueue: pendingMeta.data.slice(0, 5).map((restaurant) => ({
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
      return `${orderRef} placed`;
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
