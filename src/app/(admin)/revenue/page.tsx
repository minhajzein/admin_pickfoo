"use client";

import { useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Clock,
  Loader2,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListPagination } from "@/components/ui/list-pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import {
  fetchPlatformLedger,
  type PlatformLedgerEntry,
  type PlatformLedgerKind,
} from "@/lib/api/platform-ledger";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

type DatePreset =
  | "all"
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "this_year"
  | "custom";

const PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week", label: "This week" },
  { id: "this_month", label: "This month" },
  { id: "this_year", label: "This year" },
  { id: "custom", label: "Custom" },
];

const KIND_TABS: Array<{ id: PlatformLedgerKind; label: string }> = [
  { id: "all", label: "All activity" },
  { id: "commission", label: "Commission credits" },
  { id: "restaurant_withdrawal", label: "Restaurant withdrawals" },
  { id: "partner_payout", label: "Partner payouts" },
];

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday as start of week (local calendar). */
function startOfWeekMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfLocalDay(
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff),
  );
}

function rangeForPreset(preset: DatePreset): { from?: string; to?: string } {
  const now = new Date();
  const today = startOfLocalDay(now);

  switch (preset) {
    case "all":
      return {};
    case "today":
      return { from: toYmd(today), to: toYmd(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: toYmd(y), to: toYmd(y) };
    }
    case "this_week": {
      const start = startOfWeekMonday(today);
      return { from: toYmd(start), to: toYmd(today) };
    }
    case "this_month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toYmd(start), to: toYmd(today) };
    }
    case "this_year": {
      const start = new Date(today.getFullYear(), 0, 1);
      return { from: toYmd(start), to: toYmd(today) };
    }
    default:
      return {};
  }
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

function entryAmount(row: PlatformLedgerEntry): number {
  if (row.kind === "commission" || row.platformCommission != null) {
    return Number(row.platformCommission ?? row.amount) || 0;
  }
  return Number(row.amount) || 0;
}

function entryKind(row: PlatformLedgerEntry): Exclude<PlatformLedgerKind, "all"> {
  if (row.kind) return row.kind;
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
  const [page, setPage] = useState(1);
  const [preset, setPreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [kind, setKind] = useState<PlatformLedgerKind>("all");

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
    if (preset === "all") return "All time";
    if (preset === "custom") {
      if (customFrom && customTo) return `${customFrom} → ${customTo}`;
      if (customFrom) return `From ${customFrom}`;
      if (customTo) return `Until ${customTo}`;
      return "Custom range";
    }
    return PRESETS.find((p) => p.id === preset)?.label ?? "Period";
  }, [preset, customFrom, customTo]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["platform-ledger", page, dateRange.from, dateRange.to, kind],
    queryFn: () =>
      fetchPlatformLedger({
        page,
        limit: DEFAULT_PAGE_SIZE,
        from: dateRange.from,
        to: dateRange.to,
        kind,
      }),
    refetchInterval: 30000,
    placeholderData: keepPreviousData,
  });

  const filtered = data?.summary.filtered;
  const allTime = data?.summary.allTime;
  const wallet = data?.summary.wallet;
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const selectPreset = (next: DatePreset) => {
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
  };

  const selectKind = (next: PlatformLedgerKind) => {
    setKind(next);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Platform ledger</h2>
          <p className="text-sm text-white/50">
            Credit / debit view of commission, restaurant withdrawals, and
            partner payouts — with wallet available and payout pending.
          </p>
        </div>
        {isFetching && !isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#98E32F]" />
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-0 bg-[#98E32F] text-[#013644] overflow-hidden">
          <CardContent className="relative p-5">
            <Wallet className="absolute right-3 top-3 opacity-20" size={48} />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
              Available in wallet
            </p>
            <p className="mt-2 text-3xl font-black">
              {isLoading ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                formatMoney(wallet?.availableBalance)
              )}
            </p>
            <p className="mt-2 text-[11px] opacity-70">
              Restaurants {formatMoney(wallet?.restaurant.availableBalance)} ·
              Partners {formatMoney(wallet?.partner.availableBalance)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 text-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-white/40">
              <Clock size={16} className="text-amber-300" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                Payout pending
              </p>
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-200">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-[#98E32F]" />
              ) : (
                formatMoney(wallet?.pendingPayouts)
              )}
            </p>
            <p className="mt-2 text-[11px] text-white/35">
              Restaurant{" "}
              {formatMoney(
                wallet?.restaurant.openWithdrawalHold ??
                  wallet?.restaurant.pendingPayouts,
              )}{" "}
              · Partner {formatMoney(wallet?.partner.pendingPayouts)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 text-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-white/40">
              <ArrowUpRight size={16} className="text-[#98E32F]" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                Total credits
              </p>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-[#98E32F]" />
              ) : (
                formatMoney(wallet?.totalCredits)
              )}
            </p>
            <p className="mt-2 text-[11px] text-white/35">
              Restaurant {wallet?.restaurant.creditCount ?? 0} · Partner{" "}
              {wallet?.partner.creditCount ?? 0} entries
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 text-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-white/40">
              <ArrowDownLeft size={16} className="text-red-300" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                Total debits
              </p>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-[#98E32F]" />
              ) : (
                formatMoney(wallet?.totalDebits)
              )}
            </p>
            <p className="mt-2 text-[11px] text-white/35">
              Withdrawals paid{" "}
              {formatMoney(wallet?.restaurant.withdrawalsPaid)} · Partner paid{" "}
              {formatMoney(wallet?.partner.payoutsPaid)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat
          label="Restaurant withdrawals paid"
          value={formatMoney(wallet?.restaurant.withdrawalsPaid)}
          hint={`${wallet?.restaurant.withdrawalsByStatus.paid?.count ?? 0} paid`}
          loading={isLoading}
          icon={<Banknote size={14} className="text-sky-300" />}
        />
        <MiniStat
          label="Partner payouts paid"
          value={formatMoney(wallet?.partner.payoutsPaid)}
          hint={`${wallet?.partner.withdrawalsByStatus.paid?.count ?? 0} paid`}
          loading={isLoading}
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
          label="Commission · All time"
          value={formatMoney(allTime?.totalCommission)}
          hint={`${allTime?.orderCount ?? 0} orders · avg ${formatMoney(allTime?.avgCommission)}`}
          loading={isLoading}
          icon={<ArrowUpRight size={14} className="text-amber-300" />}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
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
                setCustomFrom(e.target.value);
                setPage(1);
              }}
              className="h-9 w-[11rem] border-white/15 bg-black/20 text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/50">To</label>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => {
                setCustomTo(e.target.value);
                setPage(1);
              }}
              className="h-9 w-[11rem] border-white/15 bg-black/20 text-white"
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
              {periodLabel} · credit / debit
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableCell colSpan={7} className="py-10 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#98E32F]" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-white/45"
                    >
                      No ledger entries for this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const direction = entryDirection(row);
                    const amount = entryAmount(row);
                    const kindKey = entryKind(row);
                    const href = entryHref(row);
                    const amountClass =
                      direction === "credit"
                        ? "text-[#98E32F]"
                        : "text-red-300";

                    return (
                      <TableRow
                        key={`${kindKey}-${row.id}`}
                        className="border-white/5 hover:bg-white/[0.03]"
                      >
                        <TableCell className="whitespace-nowrap text-sm text-white/70">
                          {formatDate(row.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm text-white/80">
                          {kindLabel(kindKey)}
                        </TableCell>
                        <TableCell>{directionBadge(direction)}</TableCell>
                        <TableCell className="max-w-[12rem] truncate text-sm">
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
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <ListPagination
            page={page}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-white/40">
        Available = restaurant + partner wallet balances still unpaid. Payout
        pending = open restaurant withdrawals + open partner payouts.
        Commission credits exclude cancelled/rejected orders.
      </p>
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
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white">
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
