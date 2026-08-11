import api from "@/lib/axios";
import type {
  AdminPartnerWithdrawal,
  PartnerWithdrawalStatus,
} from "@/lib/api/partner-withdrawals";

export interface PartnerLedgerSummary {
  partner: {
    _id: string;
    fullName: string;
    phone?: string;
    email?: string;
    status?: string;
    payoutMode: "manual" | "auto";
    deliveredOrderCount?: number;
    securityDeposit?: unknown;
  };
  summary: {
    availableBalance: number;
    pendingWithdrawal: number;
    lifetimeEarnings: number;
    weekEarnings: number;
    tipsTotal: number;
    tripCount: number;
    completedOrderCount?: number;
    totalCredits: number;
    totalDebits: number;
    openWithdrawalHold: number;
    withdrawalsByStatus: Record<string, { total: number; count: number }>;
  };
}

export type PartnerLedgerType =
  | "trip_earning"
  | "withdrawal_hold"
  | "withdrawal"
  | "withdrawal_release"
  | "adjustment";

export interface PartnerLedgerEntry {
  _id: string;
  type: PartnerLedgerType;
  direction: "credit" | "debit";
  amount: number;
  orderId?: string;
  withdrawalId?: string;
  pickfooId?: string;
  /** Exact linked withdrawal status when present. */
  withdrawalStatus?: string | null;
  meta?: {
    deliveryFee?: number;
    tipAmount?: number;
    note?: string;
    trigger?: string;
  };
  createdAt?: string;
}

export async function fetchPartnerLedger(
  partnerId: string,
): Promise<PartnerLedgerSummary> {
  const { data } = await api.get(`/partners/${partnerId}/ledger`);
  return data.data;
}

export async function fetchPartnerLedgerTransactions(
  partnerId: string,
  params?: {
    type?: string;
    direction?: string;
    search?: string;
    limit?: number;
    /** YYYY-MM-DD or ISO */
    from?: string;
    /** YYYY-MM-DD or ISO */
    to?: string;
  },
): Promise<PartnerLedgerEntry[]> {
  const { data } = await api.get(
    `/partners/${partnerId}/ledger/transactions`,
    {
      params: {
        type: params?.type,
        direction: params?.direction,
        search: params?.search,
        limit: params?.limit,
        from: params?.from || undefined,
        to: params?.to || undefined,
      },
    },
  );
  return data.data ?? [];
}

export async function fetchPartnerLedgerWithdrawals(
  partnerId: string,
  params?: {
    status?: string;
    /** YYYY-MM-DD or ISO */
    from?: string;
    /** YYYY-MM-DD or ISO */
    to?: string;
  },
): Promise<AdminPartnerWithdrawal[]> {
  const { data } = await api.get(
    `/partners/${partnerId}/ledger/withdrawals`,
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

export type { PartnerWithdrawalStatus };
