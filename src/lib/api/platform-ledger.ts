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
  tipAmount?: number;
  gstAmount?: number;
  sgstAmount?: number;
  cgstAmount?: number;
  /** GST retained by platform when restaurant is not GST-registered */
  platformGst?: number;
  gstDestination?: "restaurant" | "platform" | null;
  totalAmount?: number | null;
  commissionPercent?: number;
  platformCommission?: number;
  createdAt?: string | null;
}

export interface PlatformLedgerTotals {
  totalCommission: number;
  orderCount: number;
  avgCommission: number;
  totalGst: number;
  platformGstRetained: number;
  restaurantGstPaid: number;
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

export interface PlatformSettlementBatch {
  amount: number;
  settleAt: string;
}

export interface PlatformBankSettlement {
  expectedBankBalance: number;
  collections: number;
  settledCollections: number;
  pendingRazorpaySettlement: number;
  restaurantPendingSettlement: number;
  restaurantWithdrawalsPaid: number;
  partnerPayoutsPaid: number;
  nextSettlementAt: string | null;
  pendingByDate: PlatformSettlementBatch[];
}

export interface PlatformWalletSummary {
  availableBalance: number;
  pendingPayouts: number;
  totalCredits: number;
  totalDebits: number;
  bank?: PlatformBankSettlement | null;
  restaurant: PlatformWalletSide;
  partner: PlatformWalletSide;
}

export interface PlatformLedgerResponse {
  summary: {
    from: string | null;
    to: string | null;
    filtered: PlatformLedgerTotals;
    allTime: PlatformLedgerTotals;
    wallet: PlatformWalletSummary | null;
    bank?: PlatformBankSettlement | null;
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

function emptyBank(): PlatformBankSettlement {
  return {
    expectedBankBalance: 0,
    collections: 0,
    settledCollections: 0,
    pendingRazorpaySettlement: 0,
    restaurantPendingSettlement: 0,
    restaurantWithdrawalsPaid: 0,
    partnerPayoutsPaid: 0,
    nextSettlementAt: null,
    pendingByDate: [],
  };
}

function emptyWallet(): PlatformWalletSummary {
  return {
    availableBalance: 0,
    pendingPayouts: 0,
    totalCredits: 0,
    totalDebits: 0,
    bank: emptyBank(),
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

function mapBank(raw: unknown): PlatformBankSettlement {
  if (!raw || typeof raw !== "object") return emptyBank();
  const b = raw as Record<string, unknown>;
  const batches = Array.isArray(b.pendingByDate) ? b.pendingByDate : [];
  return {
    expectedBankBalance: Number(b.expectedBankBalance) || 0,
    collections: Number(b.collections) || 0,
    settledCollections: Number(b.settledCollections) || 0,
    pendingRazorpaySettlement: Number(b.pendingRazorpaySettlement) || 0,
    restaurantPendingSettlement: Number(b.restaurantPendingSettlement) || 0,
    restaurantWithdrawalsPaid: Number(b.restaurantWithdrawalsPaid) || 0,
    partnerPayoutsPaid: Number(b.partnerPayoutsPaid) || 0,
    nextSettlementAt:
      typeof b.nextSettlementAt === "string" ? b.nextSettlementAt : null,
    pendingByDate: batches
      .map((row) => {
        const r = row as { amount?: number; settleAt?: string };
        return {
          amount: Number(r.amount) || 0,
          settleAt: String(r.settleAt || ""),
        };
      })
      .filter((row) => row.amount > 0 && row.settleAt),
  };
}

function mapWallet(raw: unknown): PlatformWalletSummary {
  if (!raw || typeof raw !== "object") return emptyWallet();
  const walletRaw = raw as Record<string, unknown>;
  return {
    availableBalance: Number(walletRaw.availableBalance) || 0,
    pendingPayouts: Number(walletRaw.pendingPayouts) || 0,
    totalCredits: Number(walletRaw.totalCredits) || 0,
    totalDebits: Number(walletRaw.totalDebits) || 0,
    bank: mapBank(walletRaw.bank),
    restaurant: mapWalletSide(walletRaw.restaurant),
    partner: mapWalletSide(walletRaw.partner),
  };
}

function isEmptyBank(bank: PlatformBankSettlement): boolean {
  return (
    bank.pendingRazorpaySettlement === 0 &&
    bank.expectedBankBalance === 0 &&
    bank.settledCollections === 0 &&
    bank.collections === 0 &&
    bank.restaurantWithdrawalsPaid === 0 &&
    bank.partnerPayoutsPaid === 0
  );
}

export function pickBank(
  ...candidates: Array<PlatformBankSettlement | null | undefined>
): PlatformBankSettlement {
  for (const candidate of candidates) {
    if (candidate && !isEmptyBank(candidate)) return candidate;
  }
  return emptyBank();
}

export async function fetchPlatformSettlement(): Promise<PlatformBankSettlement> {
  const { data } = await api.get(`/platform-ledger/settlement`, {
    timeout: 30000,
  });
  return mapBank(data.bank ?? data.data ?? data);
}

export async function fetchPlatformWallet(): Promise<PlatformWalletSummary> {
  const { data } = await api.get(`/platform-ledger/wallet`, {
    timeout: 30000,
  });
  const wallet = mapWallet(data.wallet ?? data.data ?? data);
  const bank = pickBank(mapBank(data.bank), wallet.bank);
  return { ...wallet, bank };
}

export async function fetchPlatformLedger(params?: {
  page?: number;
  limit?: number;
  /** YYYY-MM-DD or ISO */
  from?: string;
  /** YYYY-MM-DD or ISO */
  to?: string;
  kind?: PlatformLedgerKind;
  includeWallet?: boolean;
  includeAllTime?: boolean;
  includeFilteredCommission?: boolean;
}): Promise<PlatformLedgerResponse> {
  const { data } = await api.get(`/platform-ledger`, {
    params: {
      page: params?.page,
      limit: params?.limit,
      from: params?.from || undefined,
      to: params?.to || undefined,
      kind: params?.kind || "all",
      includeWallet: params?.includeWallet ?? false,
      includeAllTime: params?.includeAllTime ?? false,
      includeFilteredCommission: params?.includeFilteredCommission ?? true,
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
        totalGst: Number(filtered.totalGst) || 0,
        platformGstRetained: Number(filtered.platformGstRetained) || 0,
        restaurantGstPaid: Number(filtered.restaurantGstPaid) || 0,
      },
      allTime: {
        totalCommission: Number(allTime.totalCommission) || 0,
        orderCount: Number(allTime.orderCount) || 0,
        avgCommission: Number(allTime.avgCommission) || 0,
        totalGst: Number(allTime.totalGst) || 0,
        platformGstRetained: Number(allTime.platformGstRetained) || 0,
        restaurantGstPaid: Number(allTime.restaurantGstPaid) || 0,
      },
      wallet: walletRaw ? mapWallet(walletRaw) : null,
      bank: mapBank(data.summary?.bank ?? data.bank),
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
