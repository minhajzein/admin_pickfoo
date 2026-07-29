import api from "@/lib/axios";
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from "@/lib/pagination";

export type WithdrawalStatus = "pending" | "approved" | "rejected" | "paid";

export interface AdminWithdrawal {
  _id: string;
  amount: number;
  status: WithdrawalStatus;
  requestedAt: string;
  processedAt?: string;
  notes?: string;
  owner?: { _id: string; name?: string; email?: string; phone?: string };
  restaurant?: {
    _id: string;
    name?: string;
    email?: string;
    contactNumber?: string;
    payoutMode?: "manual" | "auto";
  };
  bankAccount?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
  };
}

export async function fetchWithdrawals(params?: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminWithdrawal>> {
  const { data } = await api.get("/withdrawals", {
    params: {
      status: params?.status || undefined,
      search: params?.search?.trim() || undefined,
      page: params?.page ?? 1,
      limit: params?.limit ?? DEFAULT_PAGE_SIZE,
    },
  });
  return parsePaginatedResponse<AdminWithdrawal>(data);
}

export async function updateWithdrawalStatus(
  id: string,
  payload: { status: WithdrawalStatus; notes?: string },
): Promise<AdminWithdrawal> {
  const { data } = await api.patch(`/withdrawals/${id}/status`, payload);
  return data.data;
}

export async function updateRestaurantPayoutMode(
  restaurantId: string,
  payoutMode: "manual" | "auto",
): Promise<unknown> {
  const { data } = await api.patch(`/restaurants/${restaurantId}/payout-mode`, {
    payoutMode,
  });
  return data.data;
}
