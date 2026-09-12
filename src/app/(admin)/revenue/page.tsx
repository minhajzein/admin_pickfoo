"use client";

import { startTransition, useMemo, useState, type ReactNode } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowUpRight,
  Banknote,
  Clock,
  Download,
  Landmark,
  Loader2,
  Percent,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  formatSettleDay,
  PendingSettlementBatches,
} from "@/components/ledger/PendingSettlementBatches";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import {
  DATE_PRESETS,
  periodLabelFor,
  rangeForPreset,
  startOfLocalDay,
  toYmd,
  type DatePreset,
} from "@/lib/date-presets";
import {
  backfillPlatformBooks,
  createPlatformExpense,
  downloadPlatformMonthlyReportPdf,
  fetchPlatformLedger,
  fetchPlatformSettlement,
  fetchPlatformWallet,
  pickBank,
  type PlatformExpenseTag,
  type PlatformLedgerEntry,
  type PlatformLedgerKind,
} from "@/lib/api/platform-ledger";
import { cn } from "@/lib/utils";
import { visibleRefetchInterval } from "@/lib/query-live";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const KIND_TABS: Array<{ id: PlatformLedgerKind; label: string }> = [
  { id: "all", label: "All activity" },
  { id: "commission", label: "Commission credits" },
  { id: "restaurant_withdrawal", label: "Restaurant withdrawals" },
  { id: "partner_payout", label: "Partner payouts" },
  { id: "expense", label: "Expenses" },
];

const EXPENSE_TAGS: Array<{ id: PlatformExpenseTag; label: string }> = [
  { id: "bills", label: "Bills" },
  { id: "salary", label: "Salary" },
  { id: "office", label: "Office" },
  { id: "other", label: "Other" },
];

function currentIstYearMonth(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { year, month };
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatMoney(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return money.format(value);
}

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** GST cards must add up: collected = platform + restaurants. */
function splitGst(totals?: {
  totalGst?: number;
  platformGstRetained?: number;
  restaurantGstPaid?: number;
} | null) {
  const platform = roundMoney(Number(totals?.platformGstRetained) || 0);
  const collected = roundMoney(Number(totals?.totalGst) || 0);
  const reportedRestaurant = roundMoney(Number(totals?.restaurantGstPaid) || 0);
  const restaurant =
    reportedRestaurant > 0
      ? reportedRestaurant
      : roundMoney(Math.max(0, collected - platform));
  const total =
    collected > 0 ? collected : roundMoney(platform + restaurant);
  return { platform, restaurant, total };
}

function entryAmount(row: PlatformLedgerEntry): number {
  // Prefer full transaction total; fall back to amount / rebuilt parts.
  const total = Number(row.totalAmount);
  if (Number.isFinite(total) && total > 0) return total;
  const amount = Number(row.amount);
  if (Number.isFinite(amount) && amount > 0) {
    // Older API returned commission in `amount` — if platformCommission matches, rebuild.
    const commission = Number(row.platformCommission);
    if (
      Number.isFinite(commission) &&
      Math.abs(amount - commission) < 0.005
    ) {
      const rebuilt =
        (Number(row.itemTotal) || 0) +
        (Number(row.packingTotal) || 0) +
        (Number(row.deliveryFee) || 0) +
        (Number(row.tipAmount) || 0) +
        (Number(row.gstAmount) || 0);
      if (rebuilt > 0) return rebuilt;
    }
    return amount;
  }
  return (
    (Number(row.itemTotal) || 0) +
    (Number(row.packingTotal) || 0) +
    (Number(row.deliveryFee) || 0) +
    (Number(row.tipAmount) || 0) +
    (Number(row.gstAmount) || 0)
  );
}

function entryCommission(row: PlatformLedgerEntry): number | null {
  if (entryKind(row) !== "commission") return null;
  const c = Number(row.platformCommission);
  if (Number.isFinite(c)) return c;
  return null;
}

function entryGst(row: PlatformLedgerEntry): number | null {
  if (entryKind(row) !== "commission") return null;
  const g = Number(row.gstAmount);
  if (Number.isFinite(g) && g > 0) return g;
  const split =
    (Number(row.sgstAmount) || 0) + (Number(row.cgstAmount) || 0);
  if (split > 0) return split;
  return 0;
}

function entryPlatformGst(row: PlatformLedgerEntry): number | null {
  if (entryKind(row) !== "commission") return null;
  const g = Number(row.platformGst);
  if (Number.isFinite(g) && g > 0) return g;
  return null;
}

function entryGstDestination(
  row: PlatformLedgerEntry,
): "restaurant" | "platform" | null {
  if (row.gstDestination) return row.gstDestination;
  const platformGst = entryPlatformGst(row);
  if (platformGst != null && platformGst > 0) return "platform";
  const gst = entryGst(row);
  if (gst != null && gst > 0) return "restaurant";
  return null;
}

function entryKind(row: PlatformLedgerEntry): Exclude<PlatformLedgerKind, "all"> {
  if (row.kind) return row.kind;
  if (row.tags?.length) return "expense";
  if (row.platformCommission != null || row.commissionPercent != null) {
    return "commission";
  }
  return "commission";
}

function entryDirection(row: PlatformLedgerEntry): "credit" | "debit" {
  if (row.direction) return row.direction;
  return entryKind(row) === "commission" ? "credit" : "debit";
}

function entryPartyName(row: PlatformLedgerEntry): string {
  return row.partyName || row.restaurantName || "—";
}

function entryHref(row: PlatformLedgerEntry): string | null {
  if (row.href) return row.href;
  const pickfooId = row.pickfooId || row.reference;
  if (entryKind(row) === "commission" && (pickfooId || row.id)) {
    return `/orders/${pickfooId || row.id}`;
  }
  if (row.partyId && row.partyType === "restaurant") {
    return `/restaurants/${row.partyId}/ledger`;
  }
  if (row.partyId && row.partyType === "partner") {
    return `/partners/${row.partyId}/ledger`;
  }
  return null;
}

function entryReference(row: PlatformLedgerEntry): string {
  return (
    row.pickfooId ||
    row.reference ||
    (row.id ? row.id.slice(-6) : "—")
  );
}

function kindLabel(kind: Exclude<PlatformLedgerKind, "all">) {
  switch (kind) {
    case "commission":
      return "Commission";
    case "restaurant_withdrawal":
      return "Restaurant withdrawal";
    case "partner_payout":
      return "Partner payout";
    case "expense":
      return "Expense";
  }
}

function directionBadge(direction: "credit" | "debit") {
  if (direction === "credit") {
    return (
      <Badge
        variant="outline"
        className="border-[#98E32F]/30 bg-[#98E32F]/15 text-[#98E32F]"
      >
        credit
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-red-500/30 bg-red-500/15 text-red-300"
    >
      debit
    </Badge>
  );
}

function statusBadge(status?: string | null) {
  if (!status) return <span className="text-white/40">—</span>;
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    approved: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    processing: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    paid: "bg-[#98E32F]/15 text-[#98E32F] border-[#98E32F]/30",
    success: "bg-green-500/15 text-green-300 border-green-500/30",
    captured: "bg-green-500/15 text-green-300 border-green-500/30",
    rejected: "bg-red-500/15 text-red-300 border-red-500/30",
    failed: "bg-red-500/15 text-red-300 border-red-500/30",
    cancelled: "bg-white/10 text-white/50 border-white/20",
    delivered: "bg-green-500/15 text-green-300 border-green-500/30",
    ready: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  };
  return (
    <Badge
      variant="outline"
      className={map[status] ?? "border-white/15 bg-white/5 text-white/70"}
    >
      {status}
    </Badge>
  );
}

export default function RevenuePage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [preset, setPreset] = useState<DatePreset>("last_7_days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [kind, setKind] = useState<PlatformLedgerKind>("commission");
  const istNow = useMemo(() => currentIstYearMonth(), []);
  const [reportYear, setReportYear] = useState(String(istNow.year));
  const [reportMonth, setReportMonth] = useState(String(istNow.month));
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseTag, setExpenseTag] = useState<PlatformExpenseTag>("bills");
  const [expenseDate, setExpenseDate] = useState(() =>
    toYmd(startOfLocalDay(new Date())),
  );
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseInvoice, setExpenseInvoice] = useState("");
  const [expenseParty, setExpenseParty] = useState("");

  const dateRange = useMemo(() => {
    if (preset === "custom") {
      return {
        from: customFrom || undefined,
        to: customTo || undefined,
      };
    }
    return rangeForPreset(preset);
  }, [preset, customFrom, customTo]);

  const periodLabel = useMemo(() => {
    return periodLabelFor(preset, customFrom, customTo);
  }, [preset, customFrom, customTo]);

  // Heavy wallet aggregates — independent of date/kind filters so clicks stay snappy.
  const {
    data: wallet,
    isLoading: isWalletLoading,
    isFetching: isWalletFetching,
  } = useQuery({
    queryKey: ["platform-ledger-wallet"],
    queryFn: fetchPlatformWallet,
    staleTime: 60_000,
    refetchInterval: visibleRefetchInterval(60_000),
  });

  const {
    data: settlement,
    isLoading: isSettlementLoading,
  } = useQuery({
    queryKey: ["platform-ledger-settlement"],
    queryFn: fetchPlatformSettlement,
    staleTime: 60_000,
    refetchInterval: visibleRefetchInterval(60_000),
  });

  // All-time commission — changes rarely; keep off the filter click path.
  const { data: allTimeData } = useQuery({
    queryKey: ["platform-ledger-all-time"],
    queryFn: () =>
      fetchPlatformLedger({
        page: 1,
        limit: 1,
        kind: "commission",
        includeWallet: false,
        includeAllTime: true,
        includeFilteredCommission: false,
      }),
    staleTime: 120_000,
    select: (res) => res.summary.allTime,
  });

  const needsPeriodCommission =
    kind === "commission" || kind === "all" || preset !== "all";

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["platform-ledger", page, dateRange.from, dateRange.to, kind],
    queryFn: () =>
      fetchPlatformLedger({
        page,
        limit: DEFAULT_PAGE_SIZE,
        from: dateRange.from,
        to: dateRange.to,
        kind,
        includeWallet: false,
        includeAllTime: false,
        includeFilteredCommission: needsPeriodCommission,
      }),
    refetchInterval: visibleRefetchInterval(60_000),
    placeholderData: keepPreviousData,
  });

  const invalidateLedger = () => {
    queryClient.invalidateQueries({ queryKey: ["platform-ledger"] });
  };

  const expenseMutation = useMutation({
    mutationFn: () =>
      createPlatformExpense({
        amount: Number(expenseAmount),
        tag: expenseTag,
        occurredAt: expenseDate
          ? `${expenseDate}T12:00:00.000+05:30`
          : undefined,
        notes: expenseNotes.trim() || undefined,
        invoiceRef: expenseInvoice.trim() || undefined,
        partyName: expenseParty.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Expense recorded");
      setExpenseOpen(false);
      setExpenseAmount("");
      setExpenseNotes("");
      setExpenseInvoice("");
      setExpenseParty("");
      invalidateLedger();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      toast.error(msg || "Could not save expense");
    },
  });

  const pdfMutation = useMutation({
    mutationFn: () =>
      downloadPlatformMonthlyReportPdf({
        year: Number(reportYear),
        month: Number(reportMonth),
      }),
    onSuccess: () => toast.success("PDF downloaded"),
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      toast.error(msg || "Could not download PDF");
    },
  });

  const backfillMutation = useMutation({
    mutationFn: () =>
      backfillPlatformBooks({
        year: Number(reportYear),
        month: Number(reportMonth),
      }),
    onSuccess: (res) => {
      toast.success(
        `Backfilled ${res.payments} payments, ${res.restaurantPayouts} restaurant payouts, ${res.partnerPayouts} partner payouts`,
      );
      invalidateLedger();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      toast.error(msg || "Backfill failed");
    },
  });

  const filtered = data?.summary.filtered;
  const allTime = allTimeData;
  const periodGst = splitGst(filtered);
  const allTimeGst = splitGst(allTime);
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const showListFetching = isFetching && !isLoading;
  const bank = pickBank(settlement, data?.summary.bank, wallet?.bank);

  const selectPreset = (next: DatePreset) => {
    startTransition(() => {
      setPreset(next);
      setPage(1);
      if (next !== "custom") {
        setCustomFrom("");
        setCustomTo("");
      } else if (!customFrom && !customTo) {
        const today = toYmd(startOfLocalDay(new Date()));
        setCustomFrom(today);
        setCustomTo(today);
      }
    });
  };

  const selectKind = (next: PlatformLedgerKind) => {
    startTransition(() => {
      setKind(next);
      setPage(1);
    });
  };

  const onPageChange = (next: number) => {
    startTransition(() => setPage(next));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Platform ledger</h2>
          <p className="text-sm text-white/50">
            Expected Razorpay bank balance, pending T+2 settlements, GST to
            platform vs GST-registered restaurants, payouts, and tagged expenses
            for ITR / GST filing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showListFetching || isWalletFetching ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#98E32F]" />
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/15 text-white"
            onClick={() => setExpenseOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add expense
          </Button>
        </div>
      </div>

      <Card className="border-white/10 bg-white/5 text-white">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs text-white/50">Report year</Label>
            <Input
              type="number"
              min={2020}
              max={2100}
              value={reportYear}
              onChange={(e) => setReportYear(e.target.value)}
              className="h-9 w-28 border-white/15 bg-black/20 text-white"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-white/50">Month</Label>
            <select
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="h-9 w-40 rounded-md border border-white/15 bg-black/20 px-3 text-sm text-white"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleString("en-IN", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            className="bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90"
            disabled={pdfMutation.isPending}
            onClick={() => pdfMutation.mutate()}
          >
            {pdfMutation.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1 h-3.5 w-3.5" />
            )}
            Download monthly PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/15 text-white"
            disabled={backfillMutation.isPending}
            onClick={() => backfillMutation.mutate()}
          >
            {backfillMutation.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
            )}
            Backfill month books
          </Button>
          <p className="text-[11px] text-white/40 sm:ml-auto">
            PDF includes collections, payouts, expenses by tag, commission &amp;
            platform GST.
          </p>
        </CardContent>
      </Card>

      <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="h-full overflow-hidden border-0 bg-[#98E32F] text-[#013644]">
          <CardContent className="relative flex h-full flex-1 flex-col p-5">
            <Landmark className="absolute right-3 top-3 opacity-20" size={48} />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
              Expected in platform bank
            </p>
            <p className="mt-2 text-3xl font-black">
              {isSettlementLoading && !settlement ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                formatMoney(bank?.expectedBankBalance)
              )}
            </p>
            <p className="mt-auto pt-2 text-[11px] opacity-70">
              Settled collections {formatMoney(bank?.settledCollections)} −
              paid out{" "}
              {formatMoney(
                (bank?.restaurantWithdrawalsPaid ?? 0) +
                  (bank?.partnerPayoutsPaid ?? 0),
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="h-full border-white/10 bg-white/5 text-white">
          <CardContent className="flex h-full flex-1 flex-col p-5">
            <div className="flex items-center gap-2 text-white/40">
              <Clock size={16} className="text-amber-300" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                Pending Razorpay settlement
              </p>
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-200">
              {isSettlementLoading && !settlement ? (
                <Loader2 className="h-6 w-6 animate-spin text-[#98E32F]" />
              ) : (
                formatMoney(bank?.pendingRazorpaySettlement)
              )}
            </p>
            <p className="mt-auto pt-2 text-[11px] text-white/35">
              {bank?.pendingByDate?.[0]
                ? `Next ${formatSettleDay(bank.pendingByDate[0].settleAt)} · ${formatMoney(bank.pendingByDate[0].amount)}`
                : "Matches Razorpay available (T+2 not in bank yet)"}
            </p>
          </CardContent>
        </Card>

        <Card className="h-full border-white/10 bg-white/5 text-white">
          <CardContent className="flex h-full flex-1 flex-col p-5">
            <div className="flex items-center gap-2 text-white/40">
              <Percent size={16} className="text-amber-300" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                GST to platform · {periodLabel}
              </p>
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-200">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-[#98E32F]" />
              ) : (
                formatMoney(periodGst.platform)
              )}
            </p>
            <p className="mt-auto pt-2 text-[11px] text-white/35">
              No GSTIN · retained by PickFoo · all time{" "}
              {formatMoney(allTimeGst.platform)}
            </p>
          </CardContent>
        </Card>

        <Card className="h-full border-white/10 bg-white/5 text-white">
          <CardContent className="flex h-full flex-1 flex-col p-5">
            <div className="flex items-center gap-2 text-white/40">
              <Percent size={16} className="text-[#98E32F]" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                GST to restaurants · {periodLabel}
              </p>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#98E32F]">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-[#98E32F]" />
              ) : (
                formatMoney(periodGst.restaurant)
              )}
            </p>
            <p className="mt-auto pt-2 text-[11px] text-white/35">
              Valid GSTIN wallet credit · all time{" "}
              {formatMoney(allTimeGst.restaurant)}
            </p>
          </CardContent>
        </Card>
      </div>

      {bank?.pendingByDate && bank.pendingByDate.length > 0 ? (
        <Card className="gap-0 border-amber-500/20 bg-white/5 py-0 text-white">
          <CardContent className="px-4 py-2.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white/50">
                <Clock size={16} className="text-amber-300" />
                <p className="text-[10px] font-bold uppercase tracking-widest">
                  Upcoming Razorpay settlements
                </p>
              </div>
              <p className="text-[11px] text-white/35">
                T+2 not in bank yet · {bank.pendingByDate.length}{" "}
                {bank.pendingByDate.length === 1 ? "batch" : "batches"}
              </p>
            </div>
            <PendingSettlementBatches
              batches={bank.pendingByDate}
              layout="row"
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MiniStat
          label="Owed in wallets"
          value={formatMoney(wallet?.availableBalance)}
          hint={`Restaurants ${formatMoney(wallet?.restaurant.availableBalance)} · Partners ${formatMoney(wallet?.partner.availableBalance)}`}
          loading={isWalletLoading}
          icon={<Wallet size={14} className="text-[#98E32F]" />}
        />
        <MiniStat
          label="Payout pending"
          value={formatMoney(wallet?.pendingPayouts)}
          hint={`Restaurant ${formatMoney(wallet?.restaurant.openWithdrawalHold ?? wallet?.restaurant.pendingPayouts)} · Partner ${formatMoney(wallet?.partner.pendingPayouts)}`}
          loading={isWalletLoading}
          icon={<Clock size={14} className="text-amber-300" />}
        />
        <MiniStat
          label="Restaurant withdrawals paid"
          value={formatMoney(wallet?.restaurant.withdrawalsPaid)}
          hint={`${wallet?.restaurant.withdrawalsByStatus.paid?.count ?? 0} paid`}
          loading={isWalletLoading}
          icon={<Banknote size={14} className="text-sky-300" />}
        />
        <MiniStat
          label="Partner payouts paid"
          value={formatMoney(wallet?.partner.payoutsPaid)}
          hint={`${wallet?.partner.withdrawalsByStatus.paid?.count ?? 0} paid`}
          loading={isWalletLoading}
          icon={<Banknote size={14} className="text-violet-300" />}
        />
        <MiniStat
          label={`Commission · ${periodLabel}`}
          value={formatMoney(filtered?.totalCommission)}
          hint={`${filtered?.orderCount ?? 0} orders · avg ${formatMoney(filtered?.avgCommission)}`}
          loading={isLoading}
          icon={<ArrowUpRight size={14} className="text-[#98E32F]" />}
        />
        <MiniStat
          label={`GST collected · ${periodLabel}`}
          value={formatMoney(periodGst.total)}
          hint={`Platform ${formatMoney(periodGst.platform)} · restaurants ${formatMoney(periodGst.restaurant)}`}
          loading={isLoading}
          icon={<Percent size={14} className="text-sky-300" />}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {DATE_PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={preset === p.id ? "default" : "outline"}
            className={cn(
              preset === p.id
                ? "bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90"
                : "border-white/15 bg-transparent text-white/80 hover:bg-white/5 hover:text-white",
            )}
            onClick={() => selectPreset(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {preset === "custom" ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-white/50">From</label>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => {
                const value = e.target.value;
                startTransition(() => {
                  setCustomFrom(value);
                  setPage(1);
                });
              }}
              className="h-9 w-44 border-white/15 bg-black/20 text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/50">To</label>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => {
                const value = e.target.value;
                startTransition(() => {
                  setCustomTo(value);
                  setPage(1);
                });
              }}
              className="h-9 w-44 border-white/15 bg-black/20 text-white"
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-0">
        {KIND_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectKind(tab.id)}
            className={cn(
              "border-b-2 -mb-px px-4 py-2.5 text-sm font-semibold transition-colors",
              kind === tab.id
                ? "border-[#98E32F] text-[#98E32F]"
                : "border-transparent text-white/40 hover:text-white/70",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="border-white/5 bg-[#002833] text-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Ledger entries
            <span className="ml-2 text-sm font-normal text-white/45">
              {periodLabel} · full amount · GST · commission
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border border-white/10">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/50">Date</TableHead>
                  <TableHead className="text-white/50">Type</TableHead>
                  <TableHead className="text-white/50">Direction</TableHead>
                  <TableHead className="text-white/50">Party</TableHead>
                  <TableHead className="text-white/50">Reference</TableHead>
                  <TableHead className="text-white/50">Status</TableHead>
                  <TableHead className="text-right text-white/50">
                    Amount
                  </TableHead>
                  <TableHead className="text-right text-white/50">
                    GST
                  </TableHead>
                  <TableHead className="text-right text-white/50">
                    Commission
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableCell colSpan={9} className="py-10 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#98E32F]" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableCell
                      colSpan={9}
                      className="py-10 text-center text-white/45"
                    >
                      No ledger entries for this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const direction = entryDirection(row);
                    const amount = entryAmount(row);
                    const commission = entryCommission(row);
                    const gst = entryGst(row);
                    const gstDestination = entryGstDestination(row);
                    const kindKey = entryKind(row);
                    const href = entryHref(row);
                    const amountClass =
                      direction === "credit"
                        ? "text-[#98E32F]"
                        : "text-red-300";

                    return (
                      <TableRow
                        key={`${kindKey}-${row.id}`}
                        className="border-white/5 hover:bg-white/3"
                      >
                        <TableCell className="whitespace-nowrap text-sm text-white/70">
                          {formatDate(row.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm text-white/80">
                          <div className="flex flex-col gap-1">
                            <span>{kindLabel(kindKey)}</span>
                            {kindKey === "expense" && row.tags?.length
                              ? row.tags.map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="outline"
                                    className="w-fit border-amber-500/40 bg-amber-500/10 text-[10px] uppercase tracking-wide text-amber-200"
                                  >
                                    {tag}
                                  </Badge>
                                ))
                              : null}
                          </div>
                        </TableCell>
                        <TableCell>{directionBadge(direction)}</TableCell>
                        <TableCell className="max-w-48 truncate text-sm">
                          {row.partyId && href ? (
                            <Link
                              href={
                                row.partyType === "partner"
                                  ? `/partners/${row.partyId}/ledger`
                                  : row.partyType === "restaurant"
                                    ? `/restaurants/${row.partyId}/ledger`
                                    : href
                              }
                              className="text-white/85 hover:text-[#98E32F] hover:underline"
                            >
                              {entryPartyName(row)}
                            </Link>
                          ) : (
                            entryPartyName(row)
                          )}
                        </TableCell>
                        <TableCell>
                          {href ? (
                            <Link
                              href={href}
                              className="font-medium text-[#98E32F] hover:underline"
                            >
                              {entryReference(row)}
                            </Link>
                          ) : (
                            <span className="text-sm text-white/60">
                              {entryReference(row)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{statusBadge(row.status)}</TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium tabular-nums",
                            amountClass,
                          )}
                        >
                          {direction === "debit" ? "−" : "+"}
                          {formatMoney(amount)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-sky-200/90">
                          {gst != null && gst > 0 ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <span>{formatMoney(gst)}</span>
                              <span
                                className={
                                  gstDestination === "platform"
                                    ? "text-[10px] text-amber-200/80"
                                    : "text-[10px] text-[#98E32F]/80"
                                }
                              >
                                {gstDestination === "platform"
                                  ? "to platform"
                                  : "to restaurant"}
                              </span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-amber-200/90">
                          {commission != null ? formatMoney(commission) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <ListPagination
            page={page}
            limit={DEFAULT_PAGE_SIZE}
            total={total}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-white/40">
        Expected bank = customer collections already past Razorpay T+2, minus
        restaurant withdrawals and partner payouts already marked paid. Pending
        Razorpay settlement should match the Razorpay dashboard available
        balance (money not yet deposited). GST is split from each paid order:
        platform keeps GST when the restaurant has no valid GSTIN; otherwise GST
        is credited to the restaurant. Date filters use IST and apply to
        commission, GST, and ledger entries. Bank figures are live. Monthly PDF
        uses the platform cashbook (backfill historical months once if needed).
      </p>

      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent className="border-white/10 bg-[#002833] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Add platform expense</DialogTitle>
            <DialogDescription className="text-white/50">
              Bills, salary, office, or other costs — tagged for monthly ITR /
              GST reports.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-white/50">Amount (₹)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="border-white/15 bg-black/20 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-white/50">Tag</Label>
              <select
                value={expenseTag}
                onChange={(e) =>
                  setExpenseTag(e.target.value as PlatformExpenseTag)
                }
                className="h-9 w-full rounded-md border border-white/15 bg-black/20 px-3 text-sm text-white"
              >
                {EXPENSE_TAGS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-white/50">Date</Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="border-white/15 bg-black/20 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-white/50">Vendor / party (optional)</Label>
              <Input
                value={expenseParty}
                onChange={(e) => setExpenseParty(e.target.value)}
                className="border-white/15 bg-black/20 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-white/50">Invoice ref (optional)</Label>
              <Input
                value={expenseInvoice}
                onChange={(e) => setExpenseInvoice(e.target.value)}
                className="border-white/15 bg-black/20 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-white/50">Notes</Label>
              <Input
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                className="border-white/15 bg-black/20 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-white/15 text-white"
              onClick={() => setExpenseOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90"
              disabled={
                expenseMutation.isPending ||
                !expenseAmount ||
                Number(expenseAmount) <= 0
              }
              onClick={() => expenseMutation.mutate()}
            >
              {expenseMutation.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
  loading,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  loading: boolean;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-white">
      <div className="flex items-center gap-2 text-white/40">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-widest">
          {label}
        </p>
      </div>
      <p className="mt-1.5 text-lg font-semibold">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-[#98E32F]" />
        ) : (
          value
        )}
      </p>
      <p className="mt-1 text-[11px] text-white/35">{hint}</p>
    </div>
  );
}
