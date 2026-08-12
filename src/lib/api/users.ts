import api from "@/lib/axios";

export interface AdminUserDetails {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  externalUserId?: string;
  profilePicture?: string;
  role?: "user" | "owner" | "admin";
  isVerified?: boolean;
  createdAt?: string;
  defaultDeliveryAddress?: {
    label?: string;
    formattedAddress: string;
    lat: number;
    lng: number;
  };
  recentSearches?: string[];
  orderStats: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    totalCommissionEarned: number;
    hasCompletedOrder: boolean;
    lastOrderAt?: string | null;
  };
}

export async function fetchAdminUserDetails(
  userId: string,
): Promise<AdminUserDetails> {
  const { data } = await api.get(`/users/${userId}`);
  return data.data;
}
