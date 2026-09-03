"use client";

import { startTransition, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock,
  Loader2,
  Percent,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";
import api from "@/lib/axios";
import {
  fetchRestaurantLedger,
  fetchRestaurantLedgerTransactions,
  fetchRestaurantLedgerWithdrawals,
  type LedgerTxType,
  type RestaurantLedgerTransaction,
} from "@/lib/api/restaurant-ledger";
import {
  updateWithdrawalStatus,
  type AdminWithdrawal,
  type WithdrawalStatus,
} from "@/lib/api/withdrawals";
import { WithdrawalAccountDetails } from "@/components/withdrawals/WithdrawalAccountDetails";
import { PendingSettlementBatches } from "@/components/ledger/PendingSettlementBatches";
import {
  DATE_PRESETS,
  periodLabelFor,
  rangeForPreset,
  startOfLocalDay,
  toYmd,
  type DatePreset,
} from "@/lib/date-presets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

function inr(n: number | undefined | null) {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(iso?: string) {
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

function txTypeBadge(type: LedgerTxType) {
  const map: Record<LedgerTxType, string> = {
    credit: "bg-[#98E32F]/15 text-[#98E32F] border-[#98E32F]/30",
    debit: "bg-red-500/15 text-red-300 border-red-500/30",
    payout: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  };
  return (
    <Badge variant="outline" className={map[type]}>
      {type}
    </Badge>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    success: "bg-green-500/15 text-green-300 border-green-500/30",
    captured: "bg-green-500/15 text-green-300 border-green-500/30",
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    failed: "bg-red-500/15 text-red-300 border-red-500/30",
    refunded: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    approved: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    paid: "bg-[#98E32F]/15 text-[#98E32F] border-[#98E32F]/30",
    rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={map[status] ?? "bg-white/10 text-white/60"}>
      {status}
    </Badge>
  );
}

function orderLabel(tx: RestaurantLedgerTransaction) {
  const order = tx.order;
  if (!order) return "—";
  if (typeof order === "string") return order.slice(-6);
  return order.pickfooId || String(order._id).slice(-6);
}

function gstDestinationLabel(
  tx: RestaurantLedgerTransaction,
): "restaurant" | "platform" | null {
  if (tx.gstDestination) return tx.gstDestination;
  if (tx.gstInRestaurantWallet === true) return "restaurant";
  if (tx.gstInRestaurantWallet === false) return "platform";
  return null;
}

function settlementLabel(tx: RestaurantLedgerTransaction): string {
  if (tx.type !== "credit") return "—";
  if (tx.razorpaySettled === true) return "Settled";
  if (tx.withdrawableAt) {
    try {
      return `Settles ${new Date(tx.withdrawableAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })}`;
    } catch {
      return "Pending";
    }
  }
  return "Pending";
}

type Tab = "transactions" | "withdrawals";

export default function RestaurantLedgerPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const restaurantId = String(id ?? "");

  const [tab, setTab] = useState<Tab>("transactions");
  const [txType, setTxType] = useState<LedgerTxType | "all">("all");
  const [txSearch, setTxSearch] = useState("");
  const [wdStatus, setWdStatus] = useState<WithdrawalStatus | "all">("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    status: WithdrawalStatus;
  } | null>(null);

  const dateRange = useMemo(() => {
    if (datePreset === "custom") {
      return {
        from: customFrom || undefined,
        to: customTo || undefined,
      };
    }
    return rangeForPreset(datePreset);
  }, [datePreset, customFrom, customTo]);

  const periodLabel = useMemo(() => {
    return periodLabelFor(datePreset, customFrom, customTo);
  }, [datePreset, customFrom, customTo]);

  const selectDatePreset = (next: DatePreset) => {
    startTransition(() => {
      setDatePreset(next);
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

  const { data: restaurantMeta } = useQuery({
    queryKey: ["restaurant", restaurantId],
    queryFn: async () => {
      const response = await api.get(`/restaurants/${restaurantId}`);
      return response.data.data as { name?: string };
    },
    enabled: !!restaurantId,
  });

  const {
    data: ledger,
    isLoading: isLedgerLoading,
    isError: isLedgerError,
  } = useQuery({
    queryKey: [
      "restaurant-ledger",
      restaurantId,
      dateRange.from,
      dateRange.to,
    ],
    queryFn: () =>
      fetchRestaurantLedger(restaurantId, {
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: !!restaurantId,
    placeholderData: keepPreviousData,
  });

  const { data: transactions = [], isLoading: isTxLoading } = useQuery({
    queryKey: [
      "restaurant-ledger-tx",
      restaurantId,
      txType,
      txSearch,
      dateRange.from,
      dateRange.to,
    ],
    queryFn: () =>
      fetchRestaurantLedgerTransactions(restaurantId, {
        type: txType === "all" ? undefined : txType,
        search: txSearch.trim() || undefined,
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: !!restaurantId && tab === "transactions",
  });

  const { data: withdrawals = [], isLoading: isWdLoading } = useQuery({
    queryKey: [
      "restaurant-ledger-wd",
      restaurantId,
      wdStatus,
      dateRange.from,
      dateRange.to,
    ],
    queryFn: () =>
      fetchRestaurantLedgerWithdrawals(restaurantId, {
        status: wdStatus === "all" ? undefined : wdStatus,
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: !!restaurantId && tab === "withdrawals",
  });

  const wdMutation = useMutation({
    mutationFn: ({
      withdrawalId,
      nextStatus,
      note,
    }: {
      withdrawalId: string;
      nextStatus: WithdrawalStatus;
      note?: string;
    }) =>
      updateWithdrawalStatus(withdrawalId, {
        status: nextStatus,
        notes: note,
      }),
    onSuccess: () => {
      toast.success("Withdrawal updated");
      queryClient.invalidateQueries({
        queryKey: ["restaurant-ledger", restaurantId],
      });
      queryClient.invalidateQueries({
        queryKey: ["restaurant-ledger-wd", restaurantId],
      });
      queryClient.invalidateQueries({
        queryKey: ["restaurant-ledger-tx", restaurantId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      setNotesOpen(false);
      setPendingAction(null);
      setNotes("");
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      toast.error(msg || "Failed to update withdrawal");
    },
  });

  const summary = ledger?.summary;
  const restaurant = ledger?.restaurant;

  const titleName =
    restaurant?.name || restaurantMeta?.name || "Restaurant ledger";

  const openAction = (w: AdminWithdrawal, next: WithdrawalStatus) => {
    setPendingAction({ id: w._id, status: next });
    setNotes(w.notes || "");
    setNotesOpen(true);
  };

  const filteredHint = useMemo(() => {
    if (!summary) return null;
    return `${summary.creditCount} credits · ${summary.pendingPayoutCount} pending payouts`;
  }, [summary]);

  if (isLedgerLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-white/40">
        <Loader2 className="animate-spin text-[#98E32F]" size={40} />
        <p className="font-medium animate-pulse">Loading restaurant ledger...</p>
      </div>
    );
  }

  if (isLedgerError || !ledger || !summary || !restaurant) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-white/50">
        <XCircle className="text-red-400" size={40} />
        <p>Could not load ledger for this restaurant.</p>
        <Button
          variant="outline"
          className="border-white/20"
          onClick={() => router.push("/restaurants")}
        >
          Back to restaurants
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="h-8 px-2 text-white/50 hover:text-white -ml-2"
            onClick={() => router.push("/restaurants")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Restaurants
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {titleName}
            </h1>
            <p className="text-white/50 text-sm mt-1">
              Wallet, commission, withdrawals & payment history
              {filteredHint ? ` · ${filteredHint}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className="border-white/20 text-white/70 font-normal"
          >
            Commission {restaurant.commissionPercent}%
          </Badge>
          <Badge
            variant="outline"
            className="border-white/20 text-white/70 font-normal capitalize"
          >
            Payout: {restaurant.payoutMode}
          </Badge>
          {restaurant.isGstRegistered ? (
            <Badge
              variant="outline"
              className="border-[#98E32F]/40 text-[#98E32F] font-normal"
            >
              GST {restaurant.gstNumber}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-500/40 text-amber-200 font-normal"
            >
              No GSTIN · GST to platform
            </Badge>
          )}
          <Link href={`/restaurants/verify/${restaurantId}`}>
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 text-white/80"
            >
              Settings
            </Button>
          </Link>
          <Link href="/withdrawals">
            <Button
              size="sm"
              className="bg-[#98E32F] text-[#013644] hover:brightness-110 font-semibold"
            >
              All withdrawals
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-[#98E32F] border-0 text-[#013644] overflow-hidden">
          <CardContent className="p-5 relative">
            <Wallet className="absolute right-3 top-3 opacity-20" size={48} />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
              Withdrawable
            </p>
            <p className="text-3xl font-black mt-2">
              {inr(summary.withdrawable ?? summary.availableBalance)}
            </p>
            <p className="text-[11px] mt-2 opacity-70">
              Wallet {inr(summary.walletBalance ?? summary.settledBalance)} ·
              hold {inr(summary.openWithdrawalHold)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-white/40">
              <Clock size={16} className="text-amber-300" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                Pending Razorpay settlement
              </p>
            </div>
            <p className="text-2xl font-bold mt-2 text-amber-200">
              {inr(summary.pendingSettlement ?? 0)}
            </p>
            <p className="text-[11px] text-white/35 mt-2">
              T+2 still with Razorpay
              {summary.pendingCredits
                ? ` · ${inr(summary.pendingCredits)} awaiting pickup`
                : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-white/40">
              <Percent size={16} className="text-[#98E32F]" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                GST to restaurant · {periodLabel}
              </p>
            </div>
            <p className="text-2xl font-bold mt-2 text-[#98E32F]">
              {inr(
                summary.period?.gstToRestaurant ??
                  summary.gstToRestaurant ??
                  summary.totalGstInWallet ??
                  0,
              )}
            </p>
            <p className="text-[11px] text-white/35 mt-2">
              Valid GSTIN wallet credit · all time{" "}
              {inr(summary.gstToRestaurant ?? summary.totalGstInWallet ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-white/40">
              <Percent size={16} className="text-amber-300" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                GST to platform · {periodLabel}
              </p>
            </div>
            <p className="text-2xl font-bold mt-2 text-amber-200">
              {inr(
                summary.period?.gstToPlatform ?? summary.gstToPlatform ?? 0,
              )}
            </p>
            <p className="text-[11px] text-white/35 mt-2">
              Retained by PickFoo (no valid GSTIN) · all time{" "}
              {inr(summary.gstToPlatform ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {(summary.pendingByDate?.length ?? 0) > 0 ? (
        <Card className="border-amber-500/20 bg-white/5 text-white">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-200/80 mb-2">
              Razorpay settlement batches
            </p>
            <PendingSettlementBatches
              batches={summary.pendingByDate ?? []}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-white/40">
              <ArrowUpRight size={16} className="text-[#98E32F]" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                Net earnings credited
              </p>
            </div>
            <p className="text-2xl font-bold mt-2">{inr(summary.totalCredit)}</p>
            <p className="text-[11px] text-white/35 mt-2">
              {summary.creditCount} credited · food+packing{" "}
              {inr(summary.period?.totalGrossSales ?? summary.totalGrossSales)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-white/40">
              <Percent size={16} className="text-amber-300" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                Commission · {periodLabel}
              </p>
            </div>
            <p className="text-2xl font-bold mt-2 text-amber-200">
              {inr(
                summary.period?.commissionEarned ?? summary.commissionEarned,
              )}
            </p>
            <p className="text-[11px] text-white/35 mt-2">
              All time {inr(summary.commissionEarned)} ·{" "}
              {restaurant.commissionPercent}% on food
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-white/40">
              <Banknote size={16} className="text-sky-300" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                Withdrawals paid
              </p>
            </div>
            <p className="text-2xl font-bold mt-2">
              {inr(summary.withdrawalsByStatus.paid?.total ?? 0)}
            </p>
            <p className="text-[11px] text-white/35 mt-2">
              Open requests {inr(summary.openWithdrawalHold)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            ["Pending", summary.withdrawalsByStatus.pending],
            ["Approved", summary.withdrawalsByStatus.approved],
            ["Paid", summary.withdrawalsByStatus.paid],
            ["Rejected", summary.withdrawalsByStatus.rejected],
          ] as const
        ).map(([label, row]) => (
          <div
            key={label}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
          >
            <p className="text-[10px] uppercase tracking-wider text-white/35 font-bold">
              {label} withdrawals
            </p>
            <p className="text-lg font-semibold mt-1">
              {row?.count ?? 0}{" "}
              <span className="text-sm text-white/40 font-normal">
                · {inr(row?.total ?? 0)}
              </span>
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
            Period
          </span>
          {DATE_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={datePreset === p.id ? "default" : "outline"}
              className={cn(
                datePreset === p.id
                  ? "bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90"
                  : "border-white/15 bg-transparent text-white/80 hover:bg-white/5 hover:text-white",
              )}
              onClick={() => selectDatePreset(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {datePreset === "custom" ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-white/50">From</label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => {
                  const value = e.target.value;
                  startTransition(() => setCustomFrom(value));
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
                  const value = e.target.value;
                  startTransition(() => setCustomTo(value));
                }}
                className="h-9 w-[11rem] border-white/15 bg-black/20 text-white"
              />
            </div>
          </div>
        ) : null}
        <p className="text-xs text-white/40">
          Filtering {tab === "transactions" ? "transactions" : "withdrawals"}{" "}
          and GST / commission totals · {periodLabel}. Wallet, withdrawable, and
          Razorpay pending settlement are live (not period-filtered).
        </p>
      </div>

      <div className="flex gap-2 border-b border-white/10 pb-0">
        {(
          [
            ["transactions", "Transaction history"],
            ["withdrawals", "Withdrawal requests"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => startTransition(() => setTab(key))}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-[#98E32F] text-[#98E32F]"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "transactions" && (
        <Card className="bg-white/5 border-white/10 text-white overflow-hidden">
          <CardContent className="p-0">
            <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
                  size={16}
                />
                <Input
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Search order id, notes, gateway ref..."
                  className="pl-9 bg-black/20 border-white/10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["all", "credit", "debit", "payout"] as const).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={txType === t ? "default" : "outline"}
                    className={
                      txType === t
                        ? "bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]"
                        : "border-white/15 text-white/70"
                    }
                    onClick={() => startTransition(() => setTxType(t))}
                  >
                    {t === "all"
                      ? "All"
                      : t === "credit"
                        ? "Credited"
                        : t === "debit"
                          ? "Debited"
                          : "Withdrawals"}
                  </Button>
                ))}
              </div>
            </div>

            {isTxLoading ? (
              <div className="py-16 flex justify-center text-white/40">
                <Loader2 className="animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-16 text-center text-white/35 text-sm">
                No transactions found for {periodLabel.toLowerCase()}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="text-white/40">Date</TableHead>
                    <TableHead className="text-white/40">Type</TableHead>
                    <TableHead className="text-white/40">Order</TableHead>
                    <TableHead className="text-white/40">Gross / GST / Comm</TableHead>
                    <TableHead className="text-white/40">Settlement</TableHead>
                    <TableHead className="text-white/40 text-right">
                      Amount
                    </TableHead>
                    <TableHead className="text-white/40">Status</TableHead>
                    <TableHead className="text-white/40">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx._id} className="border-white/5">
                      <TableCell className="text-xs text-white/60 whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {tx.type === "credit" ? (
                            <ArrowUpRight
                              size={14}
                              className="text-[#98E32F]"
                            />
                          ) : (
                            <ArrowDownLeft
                              size={14}
                              className="text-sky-300"
                            />
                          )}
                          {txTypeBadge(tx.type)}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {orderLabel(tx)}
                      </TableCell>
                      <TableCell className="text-xs text-white/50">
                        {tx.grossAmount != null ? (
                          <>
                            {inr(tx.grossAmount)}
                            {tx.gstAmount != null ? (
                              <span
                                className={
                                  gstDestinationLabel(tx) === "platform"
                                    ? "text-amber-300/90"
                                    : "text-[#98E32F]/80"
                                }
                              >
                                {" "}
                                / {inr(tx.gstAmount)}{" "}
                                {gstDestinationLabel(tx) === "platform"
                                  ? "to platform"
                                  : gstDestinationLabel(tx) === "restaurant"
                                    ? "to restaurant"
                                    : ""}
                              </span>
                            ) : (
                              <span className="text-white/30"> / —</span>
                            )}
                            <span className="text-amber-300/80">
                              {" "}
                              / {inr(tx.commissionAmount ?? 0)}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-white/60 whitespace-nowrap">
                        {settlementLabel(tx)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {inr(tx.amount)}
                      </TableCell>
                      <TableCell>
                        {statusBadge(
                          (tx.displayStatus ||
                            tx.withdrawalStatus ||
                            tx.status) as string,
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-white/40">
                        {tx.notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "withdrawals" && (
        <Card className="bg-white/5 border-white/10 text-white overflow-hidden">
          <CardContent className="p-0">
            <div className="p-4 border-b border-white/5 flex gap-2 flex-wrap">
              {(
                ["all", "pending", "approved", "rejected", "paid"] as const
              ).map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={wdStatus === s ? "default" : "outline"}
                  className={
                    wdStatus === s
                      ? "bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]"
                      : "border-white/15 text-white/70"
                  }
                  onClick={() => startTransition(() => setWdStatus(s))}
                >
                  {s === "all" ? "All" : s}
                </Button>
              ))}
            </div>

            {isWdLoading ? (
              <div className="py-16 flex justify-center text-white/40">
                <Loader2 className="animate-spin" />
              </div>
            ) : withdrawals.length === 0 ? (
              <div className="py-16 text-center text-white/35 text-sm">
                No withdrawal requests for {periodLabel.toLowerCase()}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="text-white/40">Requested</TableHead>
                    <TableHead className="text-white/40">Amount</TableHead>
                    <TableHead className="text-white/40">Account details</TableHead>
                    <TableHead className="text-white/40">Status</TableHead>
                    <TableHead className="text-white/40">Notes</TableHead>
                    <TableHead className="text-white/40 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w) => (
                    <TableRow key={w._id} className="border-white/5">
                      <TableCell className="text-xs text-white/60 whitespace-nowrap">
                        {formatDate(w.requestedAt)}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {inr(w.amount)}
                      </TableCell>
                      <TableCell className="text-xs text-white/55 align-top">
                        <WithdrawalAccountDetails bank={w.bankAccount} />
                      </TableCell>
                      <TableCell>{statusBadge(w.status)}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs text-white/40">
                        {w.notes || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {w.status !== "paid" && w.status !== "rejected" ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-[#98E32F]/10"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-[#002833] border-white/10 text-white"
                            >
                              <DropdownMenuLabel>Update</DropdownMenuLabel>
                              {w.status === "pending" && (
                                <DropdownMenuItem
                                  onClick={() => openAction(w, "approved")}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4 text-sky-300" />{" "}
                                  Approve
                                </DropdownMenuItem>
                              )}
                              {(w.status === "pending" ||
                                w.status === "approved") && (
                                <DropdownMenuItem
                                  onClick={() => openAction(w, "paid")}
                                  className="text-[#98E32F] focus:text-[#98E32F]"
                                >
                                  <Banknote className="mr-2 h-4 w-4" /> Mark
                                  paid
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="bg-white/10" />
                              <DropdownMenuItem
                                className="text-red-400 focus:text-red-400"
                                onClick={() => openAction(w, "rejected")}
                              >
                                <XCircle className="mr-2 h-4 w-4" /> Reject
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-xs text-white/25 inline-flex items-center gap-1">
                            <Clock size={12} /> Done
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="bg-[#002833] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>
              Mark withdrawal as {pendingAction?.status}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-white/50">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="UTR / reason..."
              className="bg-black/20 border-white/10"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-white/15"
              onClick={() => setNotesOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#98E32F] text-[#013644] font-semibold"
              disabled={!pendingAction || wdMutation.isPending}
              onClick={() => {
                if (!pendingAction) return;
                wdMutation.mutate({
                  withdrawalId: pendingAction.id,
                  nextStatus: pendingAction.status,
                  note: notes.trim() || undefined,
                });
              }}
            >
              {wdMutation.isPending ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
