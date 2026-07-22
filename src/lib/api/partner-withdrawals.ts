import api from "@/lib/axios";

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
}): Promise<AdminPartnerWithdrawal[]> {
  const { data } = await api.get("/partner-withdrawals", { params });
  return data.data ?? [];
}

export async function updatePartnerWithdrawalStatus(
  id: string,
  payload: { status: PartnerWithdrawalStatus; notes?: string },
): Promise<AdminPartnerWithdrawal> {
  const { data } = await api.patch(`/partner-withdrawals/${id}/status`, payload);
  return data.data;
}
