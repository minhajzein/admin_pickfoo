"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2 } from "lucide-react";
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
import { fetchPlatformLedger } from "@/lib/api/platform-ledger";
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
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  return startOfLocalDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff));
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

export default function RevenuePage() {
  const [page, setPage] = useState(1);
  const [preset, setPreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

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
    queryKey: ["platform-ledger", page, dateRange.from, dateRange.to],
    queryFn: () =>
      fetchPlatformLedger({
        page,
        limit: DEFAULT_PAGE_SIZE,
        from: dateRange.from,
        to: dateRange.to,
      }),
    refetchInterval: 30000,
    placeholderData: keepPreviousData,
  });

  const filtered = data?.summary.filtered;
  const allTime = data?.summary.allTime;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Platform ledger</h2>
          <p className="text-sm text-white/50">
            Company commission from food item totals × restaurant commission %.
            Packing, delivery, and tips are excluded.
          </p>
        </div>
        {isFetching && !isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#98E32F]" />
        ) : null}
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title={`Commission · ${periodLabel}`}
          loading={isLoading}
          value={formatMoney(filtered?.totalCommission)}
          hint={`${filtered?.orderCount ?? 0} countable orders`}
        />
        <SummaryCard
          title={`Avg / order · ${periodLabel}`}
          loading={isLoading}
          value={formatMoney(filtered?.avgCommission)}
          hint="Mean commission for the selected period"
        />
        <SummaryCard
          title="Commission · All time"
          loading={isLoading}
          value={formatMoney(allTime?.totalCommission)}
          hint={`${allTime?.orderCount ?? 0} countable orders`}
        />
        <SummaryCard
          title="Avg / order · All time"
          loading={isLoading}
          value={formatMoney(allTime?.avgCommission)}
          hint="Mean commission across all orders"
        />
      </div>

      <Card className="border-white/5 bg-[#002833] text-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Ledger entries
            <span className="ml-2 text-sm font-normal text-white/45">
              {periodLabel}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border border-white/10">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/50">Date</TableHead>
                  <TableHead className="text-white/50">Order</TableHead>
                  <TableHead className="text-white/50">Restaurant</TableHead>
                  <TableHead className="text-white/50">Status</TableHead>
                  <TableHead className="text-right text-white/50">
                    Food
                  </TableHead>
                  <TableHead className="text-right text-white/50">%</TableHead>
                  <TableHead className="text-right text-white/50">
                    Commission
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
                      No commission entries for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-white/5 hover:bg-white/[0.03]"
                    >
                      <TableCell className="whitespace-nowrap text-sm text-white/70">
                        {formatDate(row.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/orders/${row.pickfooId || row.id}`}
                          className="font-medium text-[#98E32F] hover:underline"
                        >
                          {row.pickfooId || row.id.slice(-6)}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate text-sm">
                        {row.restaurantName || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-white/15 bg-white/5 text-xs text-white/70"
                        >
                          {row.status || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-white/70">
                        {formatMoney(row.itemTotal)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-white/50">
                        {row.commissionPercent}%
                      </TableCell>
                      <TableCell className="text-right font-medium text-[#98E32F]">
                        {formatMoney(row.platformCommission)}
                      </TableCell>
                    </TableRow>
                  ))
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
        Cancelled and rejected orders are excluded. Average = total commission ÷
        countable orders.
      </p>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  hint,
  loading,
}: {
  title: string;
  value: string;
  hint: string;
  loading: boolean;
}) {
  return (
    <Card className="border-white/5 bg-[#002833] text-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-white/60">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-[#98E32F]" />
          ) : (
            value
          )}
        </div>
        <p className="mt-1 text-xs text-white/40">{hint}</p>
      </CardContent>
    </Card>
  );
}
