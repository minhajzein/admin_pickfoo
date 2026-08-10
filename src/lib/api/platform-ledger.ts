import api from "@/lib/axios";

export type PlatformLedgerKind =
  | "all"
  | "commission"
  | "restaurant_withdrawal"
  | "partner_payout";

export type PlatformLedgerDirection = "credit" | "debit";

export interface PlatformLedgerEntry {
  id: string;
  kind?: Exclude<PlatformLedgerKind, "all">;
  direction?: PlatformLedgerDirection;
  amount?: number;
  status?: string | null;
  partyType?: "restaurant" | "partner" | "platform" | null;
  partyId?: string | null;
  partyName?: string | null;
  reference?: string | null;
  href?: string | null;
  notes?: string | null;
  /** Commission-shaped fields (legacy / commission kind) */
  pickfooId?: string | null;
  paymentStatus?: string | null;
  orderType?: string | null;
  restaurantId?: string | null;
  restaurantName?: string | null;
  itemTotal?: number;
  packingTotal?: number;
  deliveryFee?: number;
  totalAmount?: number | null;
  commissionPercent?: number;
  platformCommission?: number;
  createdAt?: string | null;
}

export interface PlatformLedgerTotals {
  totalCommission: number;
  orderCount: number;
  avgCommission: number;
}

export interface WalletStatusBucket {
  total: number;
  count: number;
}

export interface PlatformWalletSide {
  availableBalance: number;
  pendingPayouts: number;
  pendingPayoutCount?: number;
  openWithdrawalHold?: number;
  openWithdrawalCount?: number;
  settledBalance?: number;
  totalCredits: number;
  totalDebits: number;
  creditCount: number;
  debitCount: number;
  withdrawalsPaid?: number;
  payoutsPaid?: number;
  withdrawalsByStatus: Record<string, WalletStatusBucket>;
}

export interface PlatformWalletSummary {
  availableBalance: number;
  pendingPayouts: number;
  totalCredits: number;
  totalDebits: number;
  restaurant: PlatformWalletSide;
  partner: PlatformWalletSide;
}

export interface PlatformLedgerResponse {
  summary: {
    from: string | null;
    to: string | null;
    filtered: PlatformLedgerTotals;
    allTime: PlatformLedgerTotals;
    wallet: PlatformWalletSummary;
  };
  kind: PlatformLedgerKind;
  data: PlatformLedgerEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function emptyWalletSide(): PlatformWalletSide {
  return {
    availableBalance: 0,
    pendingPayouts: 0,
    pendingPayoutCount: 0,
    totalCredits: 0,
    totalDebits: 0,
    creditCount: 0,
    debitCount: 0,
    withdrawalsByStatus: {},
  };
}

function emptyWallet(): PlatformWalletSummary {
  return {
    availableBalance: 0,
    pendingPayouts: 0,
    totalCredits: 0,
    totalDebits: 0,
    restaurant: emptyWalletSide(),
    partner: emptyWalletSide(),
  };
}

function mapWalletSide(raw: unknown): PlatformWalletSide {
  const r = (raw ?? {}) as Record<string, unknown>;
  const byStatus = (r.withdrawalsByStatus ?? {}) as Record<
    string,
    { total?: number; count?: number }
  >;
  const withdrawalsByStatus: Record<string, WalletStatusBucket> = {};
  for (const [k, v] of Object.entries(byStatus)) {
    withdrawalsByStatus[k] = {
      total: Number(v?.total) || 0,
      count: Number(v?.count) || 0,
    };
  }
  return {
    availableBalance: Number(r.availableBalance) || 0,
    pendingPayouts: Number(r.pendingPayouts) || 0,
    pendingPayoutCount: Number(r.pendingPayoutCount) || 0,
    openWithdrawalHold: Number(r.openWithdrawalHold) || 0,
    openWithdrawalCount: Number(r.openWithdrawalCount) || 0,
    settledBalance: Number(r.settledBalance) || 0,
    totalCredits: Number(r.totalCredits) || 0,
    totalDebits: Number(r.totalDebits) || 0,
    creditCount: Number(r.creditCount) || 0,
    debitCount: Number(r.debitCount) || 0,
    withdrawalsPaid: Number(r.withdrawalsPaid) || 0,
    payoutsPaid: Number(r.payoutsPaid) || 0,
    withdrawalsByStatus,
  };
}

export async function fetchPlatformLedger(params?: {
  page?: number;
  limit?: number;
  /** YYYY-MM-DD or ISO */
  from?: string;
  /** YYYY-MM-DD or ISO */
  to?: string;
  kind?: PlatformLedgerKind;
}): Promise<PlatformLedgerResponse> {
  const { data } = await api.get(`/platform-ledger`, {
    params: {
      page: params?.page,
      limit: params?.limit,
      from: params?.from || undefined,
      to: params?.to || undefined,
      kind: params?.kind || "all",
    },
  });

  const page = Number(data.page) || 1;
  const limit = Number(data.limit) || params?.limit || 25;
  const total = Number(data.total) || 0;
  const filtered = data.summary?.filtered ?? {};
  const allTime = data.summary?.allTime ?? {};
  const walletRaw = data.summary?.wallet;

  return {
    summary: {
      from: data.summary?.from ?? null,
      to: data.summary?.to ?? null,
      filtered: {
        totalCommission: Number(filtered.totalCommission) || 0,
        orderCount: Number(filtered.orderCount) || 0,
        avgCommission: Number(filtered.avgCommission) || 0,
      },
      allTime: {
        totalCommission: Number(allTime.totalCommission) || 0,
        orderCount: Number(allTime.orderCount) || 0,
        avgCommission: Number(allTime.avgCommission) || 0,
      },
      wallet: walletRaw
        ? {
            availableBalance: Number(walletRaw.availableBalance) || 0,
            pendingPayouts: Number(walletRaw.pendingPayouts) || 0,
            totalCredits: Number(walletRaw.totalCredits) || 0,
            totalDebits: Number(walletRaw.totalDebits) || 0,
            restaurant: mapWalletSide(walletRaw.restaurant),
            partner: mapWalletSide(walletRaw.partner),
          }
        : emptyWallet(),
    },
    kind: (data.kind as PlatformLedgerKind) || params?.kind || "all",
    data: data.data ?? [],
    page,
    limit,
    total,
    totalPages:
      Number(data.totalPages) || Math.max(1, Math.ceil(total / limit) || 1),
  };
}
