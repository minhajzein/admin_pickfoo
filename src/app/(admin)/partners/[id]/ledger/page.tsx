"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Search,
  Wallet,
  XCircle,
  MoreHorizontal,
} from "lucide-react";
import {
  fetchPartnerLedger,
  fetchPartnerLedgerTransactions,
  fetchPartnerLedgerWithdrawals,
  type PartnerLedgerEntry,
  type PartnerLedgerType,
} from "@/lib/api/partner-ledger";
import {
  updatePartnerWithdrawalStatus,
  type AdminPartnerWithdrawal,
  type PartnerWithdrawalStatus,
} from "@/lib/api/partner-withdrawals";
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

function inr(n: number | undefined | null) {
  return `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
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

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    approved: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    processing: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    paid: "bg-[#98E32F]/15 text-[#98E32F] border-[#98E32F]/30",
    rejected: "bg-red-500/15 text-red-300 border-red-500/30",
    failed: "bg-red-500/15 text-red-300 border-red-500/30",
    cancelled: "bg-white/10 text-white/50 border-white/20",
  };
  return (
    <Badge variant="outline" className={map[status] ?? "bg-white/10 text-white/60"}>
      {status}
    </Badge>
  );
}

function typeBadge(type: PartnerLedgerType) {
  return (
    <Badge variant="outline" className="border-white/20 text-white/70 font-normal">
      {type.replace(/_/g, " ")}
    </Badge>
  );
}

type Tab = "transactions" | "withdrawals";

export default function PartnerLedgerPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const partnerId = String(id ?? "");

  const [tab, setTab] = useState<Tab>("transactions");
  const [txType, setTxType] = useState<PartnerLedgerType | "all">("all");
  const [txSearch, setTxSearch] = useState("");
  const [wdStatus, setWdStatus] = useState<PartnerWithdrawalStatus | "all">(
    "all",
  );
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    status: PartnerWithdrawalStatus;
  } | null>(null);

  const {
    data: ledger,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["partner-ledger", partnerId],
    queryFn: () => fetchPartnerLedger(partnerId),
    enabled: !!partnerId,
  });

  const { data: transactions = [], isLoading: isTxLoading } = useQuery({
    queryKey: ["partner-ledger-tx", partnerId, txType, txSearch],
    queryFn: () =>
      fetchPartnerLedgerTransactions(partnerId, {
        type: txType === "all" ? undefined : txType,
        search: txSearch.trim() || undefined,
      }),
    enabled: !!partnerId && tab === "transactions",
  });

  const { data: withdrawals = [], isLoading: isWdLoading } = useQuery({
    queryKey: ["partner-ledger-wd", partnerId, wdStatus],
    queryFn: () =>
      fetchPartnerLedgerWithdrawals(partnerId, {
        status: wdStatus === "all" ? undefined : wdStatus,
      }),
    enabled: !!partnerId && tab === "withdrawals",
  });

  const wdMutation = useMutation({
    mutationFn: ({
      withdrawalId,
      nextStatus,
      note,
    }: {
      withdrawalId: string;
      nextStatus: PartnerWithdrawalStatus;
      note?: string;
    }) =>
      updatePartnerWithdrawalStatus(withdrawalId, {
        status: nextStatus,
        notes: note,
      }),
    onSuccess: () => {
      toast.success("Withdrawal updated");
      queryClient.invalidateQueries({ queryKey: ["partner-ledger", partnerId] });
      queryClient.invalidateQueries({
        queryKey: ["partner-ledger-wd", partnerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["partner-ledger-tx", partnerId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-partner-withdrawals"] });
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
  const partner = ledger?.partner;

  const openAction = (
    w: AdminPartnerWithdrawal,
    next: PartnerWithdrawalStatus,
  ) => {
    setPendingAction({ id: w._id, status: next });
    setNotes(w.notes || "");
    setNotesOpen(true);
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-white/40">
        <Loader2 className="animate-spin text-[#98E32F]" size={40} />
        <p className="font-medium animate-pulse">Loading partner ledger...</p>
      </div>
    );
  }

  if (isError || !ledger || !summary || !partner) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-white/50">
        <XCircle className="text-red-400" size={40} />
        <p>Could not load ledger for this partner.</p>
        <Button
          variant="outline"
          className="border-white/20"
          onClick={() => router.push("/partners")}
        >
          Back to partners
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
            onClick={() => router.push("/partners")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Partners
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {partner.fullName}
            </h1>
            <p className="text-white/50 text-sm mt-1">
              Pocket balance, trip earnings & withdrawals
              {partner.phone ? ` · ${partner.phone}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className="border-white/20 text-white/70 font-normal capitalize"
          >
            Payout: {partner.payoutMode}
          </Badge>
          <Link href={`/partners/${partnerId}`}>
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 text-white/80"
            >
              Profile
            </Button>
          </Link>
          <Link href="/partner-withdrawals">
            <Button
              size="sm"
              className="bg-[#98E32F] text-[#013644] hover:brightness-110 font-semibold"
            >
              All partner payouts
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-[#98E32F] border-0 text-[#013644]">
          <CardContent className="p-5 relative">
            <Wallet className="absolute right-3 top-3 opacity-20" size={48} />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
              Available balance
            </p>
            <p className="text-3xl font-black mt-2">
              {inr(summary.availableBalance)}
            </p>
            <p className="text-[11px] mt-2 opacity-70">
              Hold {inr(summary.pendingWithdrawal)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Lifetime earnings
            </p>
            <p className="text-2xl font-bold mt-2">
              {inr(summary.lifetimeEarnings)}
            </p>
            <p className="text-[11px] text-white/35 mt-2">
              {summary.completedOrderCount ?? summary.tripCount} trips · tips{" "}
              {inr(summary.tipsTotal)}
              <span className="block mt-0.5">
                Earnings = delivery fee + tip (not order total)
              </span>
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              This week
            </p>
            <p className="text-2xl font-bold mt-2">
              {inr(summary.weekEarnings)}
            </p>
            <p className="text-[11px] text-white/35 mt-2">UTC week to date</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Withdrawals paid
            </p>
            <p className="text-2xl font-bold mt-2">
              {inr(summary.withdrawalsByStatus.paid?.total ?? 0)}
            </p>
            <p className="text-[11px] text-white/35 mt-2">
              Open {inr(summary.openWithdrawalHold)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 border-b border-white/10">
        {(
          [
            ["transactions", "Transaction history"],
            ["withdrawals", "Withdrawal requests"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
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
                  placeholder="Search order id / notes..."
                  className="pl-9 bg-black/20 border-white/10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    "all",
                    "trip_earning",
                    "withdrawal_hold",
                    "withdrawal",
                    "withdrawal_release",
                    "adjustment",
                  ] as const
                ).map((t) => (
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
                    onClick={() => setTxType(t)}
                  >
                    {t === "all" ? "All" : t.replace(/_/g, " ")}
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
                No ledger entries
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="text-white/40">Date</TableHead>
                    <TableHead className="text-white/40">Type</TableHead>
                    <TableHead className="text-white/40">Order</TableHead>
                    <TableHead className="text-white/40">Tip</TableHead>
                    <TableHead className="text-white/40 text-right">
                      Amount
                    </TableHead>
                    <TableHead className="text-white/40">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx: PartnerLedgerEntry) => (
                    <TableRow key={tx._id} className="border-white/5">
                      <TableCell className="text-xs text-white/60 whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {tx.direction === "credit" ? (
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
                          {typeBadge(tx.type)}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {tx.pickfooId || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-white/50">
                        {tx.meta?.tipAmount ? inr(tx.meta.tipAmount) : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          tx.direction === "credit"
                            ? "text-[#98E32F]"
                            : "text-sky-200"
                        }`}
                      >
                        {tx.direction === "credit" ? "+" : "−"}
                        {inr(tx.amount)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-white/40">
                        {tx.meta?.note || "—"}
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
                [
                  "all",
                  "pending",
                  "approved",
                  "processing",
                  "paid",
                  "rejected",
                  "failed",
                ] as const
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
                  onClick={() => setWdStatus(s)}
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
                No withdrawal requests
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="text-white/40">Requested</TableHead>
                    <TableHead className="text-white/40">Amount</TableHead>
                    <TableHead className="text-white/40">Trigger</TableHead>
                    <TableHead className="text-white/40">Bank</TableHead>
                    <TableHead className="text-white/40">Status</TableHead>
                    <TableHead className="text-white/40 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w) => {
                    const bank = w.bankAccountId;
                    return (
                      <TableRow key={w._id} className="border-white/5">
                        <TableCell className="text-xs text-white/60 whitespace-nowrap">
                          {formatDate(w.createdAt)}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {inr(w.amount)}
                        </TableCell>
                        <TableCell className="text-xs capitalize text-white/50">
                          {w.trigger || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-white/55">
                          <div>{bank?.bankName || "—"}</div>
                          <div className="text-white/35">
                            {bank?.accountHolderName}{" "}
                            {bank?.accountNumberLast4
                              ? `•••• ${bank.accountNumberLast4}`
                              : ""}
                          </div>
                        </TableCell>
                        <TableCell>{statusBadge(w.status)}</TableCell>
                        <TableCell className="text-right">
                          {w.status === "pending" || w.status === "approved" ? (
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
                                <DropdownMenuItem
                                  onClick={() => openAction(w, "paid")}
                                  className="text-[#98E32F] focus:text-[#98E32F]"
                                >
                                  <Banknote className="mr-2 h-4 w-4" /> Mark
                                  paid
                                </DropdownMenuItem>
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
                    );
                  })}
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
