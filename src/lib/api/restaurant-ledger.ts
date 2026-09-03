import api from "@/lib/axios";
import type { AdminWithdrawal, WithdrawalStatus } from "@/lib/api/withdrawals";

export type LedgerTxType = "credit" | "debit" | "payout";
export type LedgerTxStatus =
  | "pending"
  | "success"
  | "failed"
  | "refunded"
  | "captured"
  | "approved"
  | "paid"
  | "rejected";

export interface RestaurantLedgerSummary {
  restaurant: {
    _id: string;
    name: string;
    email?: string;
    contactNumber?: string;
    commissionPercent: number;
    payoutMode: "manual" | "auto";
    status?: string;
    gstNumber?: string | null;
    isGstRegistered?: boolean;
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
    totalGstInWallet?: number;
    gstToRestaurant?: number;
    gstToPlatform?: number;
    pendingCredits?: number;
    pendingSettlement?: number;
    withdrawable?: number;
    walletBalance?: number;
    nextSettlementAt?: string | null;
    pendingByDate?: Array<{ amount: number; settleAt: string }>;
    openWithdrawalHold: number;
    withdrawalsByStatus: Record<
      string,
      { total: number; count: number }
    >;
    period?: {
      from: string | null;
      to: string | null;
      creditCount: number;
      totalGrossSales: number;
      totalFoodSales: number;
      commissionEarned: number;
      gstToRestaurant: number;
      gstToPlatform: number;
    };
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
  gstAmount?: number | null;
  gstInRestaurantWallet?: boolean | null;
  gstDestination?: "restaurant" | "platform" | null;
  withdrawableAt?: string | null;
  razorpaySettled?: boolean | null;
  /** Linked withdrawal lifecycle status for payout rows. */
  withdrawalStatus?: WithdrawalStatus | string | null;
  displayStatus?: string | null;
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
  params?: {
    from?: string;
    to?: string;
  },
): Promise<RestaurantLedgerSummary> {
  const { data } = await api.get(`/restaurants/${restaurantId}/ledger`, {
    params: {
      from: params?.from || undefined,
      to: params?.to || undefined,
    },
  });
  return data.data;
}

export async function fetchRestaurantLedgerTransactions(
  restaurantId: string,
  params?: {
    type?: string;
    status?: string;
    search?: string;
    limit?: number;
    /** YYYY-MM-DD or ISO */
    from?: string;
    /** YYYY-MM-DD or ISO */
    to?: string;
  },
): Promise<RestaurantLedgerTransaction[]> {
  const { data } = await api.get(
    `/restaurants/${restaurantId}/ledger/transactions`,
    {
      params: {
        type: params?.type,
        status: params?.status,
        search: params?.search,
        limit: params?.limit,
        from: params?.from || undefined,
        to: params?.to || undefined,
      },
    },
  );
  return data.data ?? [];
}

export async function fetchRestaurantLedgerWithdrawals(
  restaurantId: string,
  params?: {
    status?: string;
    /** YYYY-MM-DD or ISO */
    from?: string;
    /** YYYY-MM-DD or ISO */
    to?: string;
  },
): Promise<AdminWithdrawal[]> {
  const { data } = await api.get(
    `/restaurants/${restaurantId}/ledger/withdrawals`,
    {
      params: {
        status: params?.status,
        from: params?.from || undefined,
        to: params?.to || undefined,
      },
    },
  );
  return data.data ?? [];
}
