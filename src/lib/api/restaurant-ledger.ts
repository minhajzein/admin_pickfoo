import api from "@/lib/axios";
import type { AdminWithdrawal, WithdrawalStatus } from "@/lib/api/withdrawals";

export type LedgerTxType = "credit" | "debit" | "payout";
export type LedgerTxStatus =
  | "pending"
  | "success"
  | "failed"
  | "refunded"
  | "captured";

export interface RestaurantLedgerSummary {
  restaurant: {
    _id: string;
    name: string;
    email?: string;
    contactNumber?: string;
    commissionPercent: number;
    payoutMode: "manual" | "auto";
    status?: string;
  };
  summary: {
    availableBalance: number;
    settledBalance: number;
    totalCredit: number;
    totalDebit: number;
    totalEarnings: number;
    pendingPayouts: number;
    pendingPayoutCount: number;
    payoutSettled: number;
    creditCount: number;
    debitCount?: number;
    totalGrossSales: number;
    totalFoodSales?: number;
    commissionEarned: number;
    commissionParsedCount: number;
    openWithdrawalHold: number;
    withdrawalsByStatus: Record<
      string,
      { total: number; count: number }
    >;
  };
}

export interface RestaurantLedgerTransaction {
  _id: string;
  amount: number;
  status: LedgerTxStatus;
  type: LedgerTxType;
  paymentGateway?: string;
  gatewayTransactionId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  commissionAmount?: number | null;
  grossAmount?: number | null;
  foodAmount?: number | null;
  packingAmount?: number | null;
  order?: {
    _id: string;
    pickfooId?: string;
    status?: string;
    totalAmount?: number;
    paymentStatus?: string;
  } | string | null;
  withdrawal?: {
    _id: string;
    status?: WithdrawalStatus;
    amount?: number;
    requestedAt?: string;
  } | string | null;
}

export async function fetchRestaurantLedger(
  restaurantId: string,
): Promise<RestaurantLedgerSummary> {
  const { data } = await api.get(`/restaurants/${restaurantId}/ledger`);
  return data.data;
}

export async function fetchRestaurantLedgerTransactions(
  restaurantId: string,
  params?: { type?: string; status?: string; search?: string; limit?: number },
): Promise<RestaurantLedgerTransaction[]> {
  const { data } = await api.get(
    `/restaurants/${restaurantId}/ledger/transactions`,
    { params },
  );
  return data.data ?? [];
}

export async function fetchRestaurantLedgerWithdrawals(
  restaurantId: string,
  params?: { status?: string },
): Promise<AdminWithdrawal[]> {
  const { data } = await api.get(
    `/restaurants/${restaurantId}/ledger/withdrawals`,
    { params },
  );
  return data.data ?? [];
}
