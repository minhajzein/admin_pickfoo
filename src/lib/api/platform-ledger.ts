import api from "@/lib/axios";

export interface PlatformLedgerEntry {
  id: string;
  pickfooId?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  orderType?: string | null;
  restaurantId?: string | null;
  restaurantName?: string | null;
  itemTotal: number;
  packingTotal: number;
  deliveryFee: number;
  totalAmount?: number | null;
  commissionPercent: number;
  platformCommission: number;
  createdAt?: string | null;
}

export interface PlatformLedgerTotals {
  totalCommission: number;
  orderCount: number;
  avgCommission: number;
}

export interface PlatformLedgerResponse {
  summary: {
    from: string | null;
    to: string | null;
    filtered: PlatformLedgerTotals;
    allTime: PlatformLedgerTotals;
  };
  data: PlatformLedgerEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function fetchPlatformLedger(params?: {
  page?: number;
  limit?: number;
  /** YYYY-MM-DD or ISO */
  from?: string;
  /** YYYY-MM-DD or ISO */
  to?: string;
}): Promise<PlatformLedgerResponse> {
  const { data } = await api.get(`/platform-ledger`, {
    params: {
      page: params?.page,
      limit: params?.limit,
      from: params?.from || undefined,
      to: params?.to || undefined,
    },
  });

  const page = Number(data.page) || 1;
  const limit = Number(data.limit) || params?.limit || 25;
  const total = Number(data.total) || 0;
  const filtered = data.summary?.filtered ?? {};
  const allTime = data.summary?.allTime ?? {};

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
    },
    data: data.data ?? [],
    page,
    limit,
    total,
    totalPages:
      Number(data.totalPages) || Math.max(1, Math.ceil(total / limit) || 1),
  };
}
