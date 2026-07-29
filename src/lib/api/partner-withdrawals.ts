import api from "@/lib/axios";
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from "@/lib/pagination";

export type PartnerWithdrawalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "paid"
  | "processing"
  | "failed"
  | "cancelled";

export interface AdminPartnerWithdrawal {
  _id: string;
  amount: number;
  status: PartnerWithdrawalStatus;
  trigger?: "manual" | "auto";
  createdAt: string;
  processedAt?: string;
  notes?: string;
  failureReason?: string;
  partnerId?: {
    _id: string;
    fullName?: string;
    phone?: string;
    email?: string;
    status?: string;
    payoutMode?: "manual" | "auto";
  };
  bankAccountId?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    accountNumberLast4?: string;
    ifscCode?: string;
  };
}

export async function fetchPartnerWithdrawals(params?: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminPartnerWithdrawal>> {
  const { data } = await api.get("/partner-withdrawals", {
    params: {
      status: params?.status || undefined,
      search: params?.search?.trim() || undefined,
      page: params?.page ?? 1,
      limit: params?.limit ?? DEFAULT_PAGE_SIZE,
    },
  });
  return parsePaginatedResponse<AdminPartnerWithdrawal>(data);
}

export async function updatePartnerWithdrawalStatus(
  id: string,
  payload: { status: PartnerWithdrawalStatus; notes?: string },
): Promise<AdminPartnerWithdrawal> {
  const { data } = await api.patch(`/partner-withdrawals/${id}/status`, payload);
  return data.data;
}
