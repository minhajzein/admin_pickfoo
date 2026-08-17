"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Megaphone,
  RotateCcw,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  fetchCustomerPaymentSummary,
  fetchCustomerPaymentTransactions,
  refundCustomerPayment,
  raiseCustomerOrderFromPayment,
  raiseCustomerOrderFromRefs,
  type CustomerPaymentStatus,
  type CustomerPaymentTransaction,
} from "@/lib/api/customer-payments";
import {
  buildRefundSettlementPayload,
  emptyRefundSettlementState,
  fetchRefundPreview,
  validateRefundSettlement,
  type RefundSettlementState,
} from "@/lib/api/refund-settlement";
import { RefundSettlementFields } from "@/components/refund/RefundSettlementFields";
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
    captured: "bg-[#98E32F]/15 text-[#98E32F] border-[#98E32F]/30",
    success: "bg-[#98E32F]/15 text-[#98E32F] border-[#98E32F]/30",
    created: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    failed: "bg-red-500/15 text-red-300 border-red-500/30",
    refunded: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  };
  return (
    <Badge variant="outline" className={map[status] ?? "bg-white/10 text-white/60"}>
      {status}
    </Badge>
  );
}

function orderRefFromTx(tx: CustomerPaymentTransaction): string | null {
  const order = tx.order;
  if (!order) return null;
  if (typeof order === "string") return order;
  return order.pickfooId || String(order._id);
}

function orderLabel(tx: CustomerPaymentTransaction) {
  const order = tx.order;
  if (!order) return "—";
  if (typeof order === "string") return order.slice(-6);
  return order.pickfooId || String(order._id).slice(-6);
}

function restaurantName(tx: CustomerPaymentTransaction) {
  const r = tx.restaurant;
  if (!r) return "—";
  if (typeof r === "string") return r.slice(-6);
  return r.name || "—";
}

function orderNeedsRaise(tx: CustomerPaymentTransaction): boolean {
  if (tx.status !== "captured" && tx.status !== "success") return false;
  const order = tx.order;
  if (!order) return true;
  if (typeof order === "string") return false;
  const status = (order.status || "").toLowerCase();
  const payment = (order.paymentStatus || "").toLowerCase();
  if (payment === "paid" && ["confirmed", "preparing", "ready", "out-for-delivery", "delivered"].includes(status)) {
    return false;
  }
  return (
    status === "payment-expired" ||
    status === "cancelled" ||
    status === "accepted-awaiting-payment" ||
    payment !== "paid"
  );
}

type StatusFilter = CustomerPaymentStatus | "all";

export default function CustomerPaymentsPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = String(id ?? "");

  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundTx, setRefundTx] = useState<CustomerPaymentTransaction | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [recordOnly, setRecordOnly] = useState(false);
  const [refundSettlement, setRefundSettlement] = useState<RefundSettlementState>(
    emptyRefundSettlementState(),
  );
  const refundOrderRef = refundTx ? orderRefFromTx(refundTx) : null;

  const { data: refundPreview, isLoading: refundPreviewLoading } = useQuery({
    queryKey: ["orders", "refund-preview", refundOrderRef],
    queryFn: () => fetchRefundPreview(refundOrderRef!),
    enabled: refundOpen && !!refundOrderRef,
  });
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [raiseOrderId, setRaiseOrderId] = useState("");
  const [raiseRpOrderId, setRaiseRpOrderId] = useState("");
  const [raiseRpPaymentId, setRaiseRpPaymentId] = useState("");

  const {
    data: summaryData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["customer-payments", userId],
    queryFn: () => fetchCustomerPaymentSummary(userId),
    enabled: !!userId,
  });

  const { data: transactions = [], isLoading: isTxLoading } = useQuery({
    queryKey: ["customer-payments-tx", userId, status, search],
    queryFn: () =>
      fetchCustomerPaymentTransactions(userId, {
        status: status === "all" ? undefined : status,
        search: search.trim() || undefined,
      }),
    enabled: !!userId,
  });

  const refundMutation = useMutation({
    mutationFn: () => {
      if (!refundTx) throw new Error("No payment selected");
      const captured = Number(refundTx.amount) || 0;
      const presets = refundPreview?.presets ?? {
        fullAmount: captured,
        netItemsPackingAmount: captured,
        itemTotal: 0,
        packingTotal: 0,
        discountAmount: 0,
      };
      const caps = refundPreview?.caps ?? {
        maxRestaurantDeduction: 0,
        maxPartnerDeduction: 0,
        assignedPartnerId: null,
        hasRestaurantCredit: false,
        hasPartnerTripEarning: false,
      };
      if (refundOrderRef && !refundPreview) {
        throw new Error("Refund options are still loading");
      }
      const validationError = validateRefundSettlement(
        refundSettlement,
        presets,
        caps,
        captured || undefined,
      );
      if (validationError) throw new Error(validationError);
      const settlement = buildRefundSettlementPayload(
        refundSettlement,
        presets,
      );
      return refundCustomerPayment(userId, refundTx._id, {
        reason: reason.trim() || undefined,
        recordOnly,
        ...settlement,
      });
    },
    onSuccess: (res) => {
      const wd = res.walletDeductions;
      let msg = res.razorpay
        ? "Refund issued via Razorpay"
        : "Payment marked as refunded";
      if (wd && (wd.restaurantApplied > 0 || wd.partnerApplied > 0)) {
        const parts: string[] = [];
        if (wd.restaurantApplied > 0) {
          parts.push(`restaurant −₹${wd.restaurantApplied}`);
        }
        if (wd.partnerApplied > 0) {
          parts.push(`partner −₹${wd.partnerApplied}`);
        }
        msg += ` · ${parts.join(", ")}`;
      }
      toast.success(msg);
      queryClient.invalidateQueries({
        queryKey: ["customer-payments", userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["customer-payments-tx", userId],
      });
      setRefundOpen(false);
      setRefundTx(null);
      setReason("");
      setRecordOnly(false);
      setRefundSettlement(emptyRefundSettlementState());
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : err instanceof Error
            ? err.message
            : undefined;
      toast.error(msg || "Refund failed");
    },
  });

  const raiseTxMutation = useMutation({
    mutationFn: (txId: string) => raiseCustomerOrderFromPayment(userId, txId),
    onSuccess: (res) => {
      toast.success(
        res.alreadyRaised
          ? "Order was already raised"
          : "Order raised — restaurant alerted and marked confirmed",
      );
      queryClient.invalidateQueries({ queryKey: ["customer-payments", userId] });
      queryClient.invalidateQueries({
        queryKey: ["customer-payments-tx", userId],
      });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      toast.error(msg || "Could not raise order");
    },
  });

  const raiseRefsMutation = useMutation({
    mutationFn: () =>
      raiseCustomerOrderFromRefs(userId, {
        orderId: raiseOrderId.trim() || undefined,
        razorpayOrderId: raiseRpOrderId.trim() || undefined,
        razorpayPaymentId: raiseRpPaymentId.trim() || undefined,
      }),
    onSuccess: (res) => {
      toast.success(
        res.alreadyRaised
          ? "Order was already raised"
          : "Order raised — restaurant alerted and marked confirmed",
      );
      queryClient.invalidateQueries({ queryKey: ["customer-payments", userId] });
      queryClient.invalidateQueries({
        queryKey: ["customer-payments-tx", userId],
      });
      setRaiseOpen(false);
      setRaiseOrderId("");
      setRaiseRpOrderId("");
      setRaiseRpPaymentId("");
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      toast.error(msg || "Could not raise order");
    },
  });

  const summary = summaryData?.summary;
  const user = summaryData?.user;

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-white/40">
        <Loader2 className="animate-spin text-[#98E32F]" size={40} />
        <p className="font-medium animate-pulse">Loading payments...</p>
      </div>
    );
  }

  if (isError || !summaryData || !summary || !user) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-white/50">
        <XCircle className="text-red-400" size={40} />
        <p>Could not load payments for this user.</p>
        <Button
          variant="outline"
          className="border-white/20"
          onClick={() => router.push("/users")}
        >
          Back to users
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
            onClick={() => router.push("/users")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Users
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {user.name || "Customer"}
            </h1>
            <p className="text-white/50 text-sm mt-1">
              Payments, Razorpay captures & refunds
              {user.phone ? ` · ${user.phone}` : ""}
              {user.externalUserId ? ` · ${user.externalUserId}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/users/${userId}`}>
            <Button
              variant="outline"
              className="border-white/15 text-white/80"
            >
              Customer details
            </Button>
          </Link>
          <Button
            variant="outline"
            className="border-[#98E32F]/40 text-[#98E32F] hover:bg-[#98E32F]/10"
            onClick={() => setRaiseOpen(true)}
          >
            <Megaphone className="mr-2 h-4 w-4" />
            Raise paid order
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-[#98E32F] border-0 text-[#013644]">
          <CardContent className="p-5 relative">
            <Wallet className="absolute right-3 top-3 opacity-20" size={48} />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
              Total paid
            </p>
            <p className="text-3xl font-black mt-2">{inr(summary.totalPaid)}</p>
            <p className="text-[11px] mt-2 opacity-70">
              {summary.paidCount} captured payments
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Refunded
            </p>
            <p className="text-2xl font-bold mt-2 text-sky-200">
              {inr(summary.totalRefunded)}
            </p>
            <p className="text-[11px] text-white/35 mt-2">
              {summary.refundedCount} refunds
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Failed
            </p>
            <p className="text-2xl font-bold mt-2">{summary.failedCount}</p>
            <p className="text-[11px] text-white/35 mt-2">Payment attempts</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Pending / created
            </p>
            <p className="text-2xl font-bold mt-2">{summary.pendingCount}</p>
            <p className="text-[11px] text-white/35 mt-2">
              Incomplete checkouts
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10 text-white overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
                size={16}
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order, Razorpay id, restaurant..."
                className="pl-9 bg-black/20 border-white/10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(
                ["all", "captured", "refunded", "failed", "created"] as const
              ).map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={status === s ? "default" : "outline"}
                  className={
                    status === s
                      ? "bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]"
                      : "border-white/15 text-white/70"
                  }
                  onClick={() => setStatus(s)}
                >
                  {s === "all" ? "All" : s}
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
              No payment transactions
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-white/40">Date</TableHead>
                  <TableHead className="text-white/40">Order</TableHead>
                  <TableHead className="text-white/40">Restaurant</TableHead>
                  <TableHead className="text-white/40 text-right">
                    Amount
                  </TableHead>
                  <TableHead className="text-white/40">Status</TableHead>
                  <TableHead className="text-white/40">Razorpay</TableHead>
                  <TableHead className="text-white/40 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx._id} className="border-white/5">
                    <TableCell className="text-xs text-white/60 whitespace-nowrap">
                      {formatDate(tx.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {orderLabel(tx)}
                    </TableCell>
                    <TableCell className="text-sm text-white/70">
                      {restaurantName(tx)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {inr(tx.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {statusBadge(tx.status)}
                        {tx.status === "refunded" &&
                          tx.metadata?.refundReason && (
                            <p className="text-[10px] text-white/35 max-w-[160px] truncate">
                              {tx.metadata.refundReason}
                            </p>
                          )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] font-mono text-white/40 max-w-[140px]">
                      <div className="truncate">
                        {tx.razorpayPaymentId || tx.razorpayOrderId || "—"}
                      </div>
                      {tx.metadata?.razorpayRefundId && (
                        <div className="truncate text-sky-300/70">
                          rfnd {tx.metadata.razorpayRefundId}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {orderNeedsRaise(tx) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#98E32F]/40 text-[#98E32F] hover:bg-[#98E32F]/10"
                            disabled={raiseTxMutation.isPending}
                            onClick={() => raiseTxMutation.mutate(tx._id)}
                          >
                            <Megaphone className="mr-1 h-3.5 w-3.5" />
                            Raise
                          </Button>
                        ) : null}
                        {tx.status === "captured" || tx.status === "success" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10"
                            onClick={() => {
                              setRefundTx(tx);
                              setReason("");
                              setRecordOnly(false);
                              setRefundSettlement(emptyRefundSettlementState());
                              setRefundOpen(true);
                            }}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            Refund
                          </Button>
                        ) : (
                          orderNeedsRaise(tx) ? null : (
                            <span className="text-xs text-white/25">—</span>
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={refundOpen}
        onOpenChange={(open) => {
          setRefundOpen(open);
          if (!open) {
            setRefundTx(null);
            setReason("");
            setRecordOnly(false);
            setRefundSettlement(emptyRefundSettlementState());
          }
        }}
      >
        <DialogContent className="bg-[#002833] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Refund payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-white/50">
              Order {refundTx ? orderLabel(refundTx) : "—"} · captured{" "}
              {refundTx ? inr(refundTx.amount) : ""}
            </p>
            {refundOrderRef ? (
              refundPreviewLoading || !refundPreview ? (
                <div className="flex items-center justify-center py-8 text-white/50">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading refund options…
                </div>
              ) : (
                <RefundSettlementFields
                  state={refundSettlement}
                  onChange={setRefundSettlement}
                  presets={refundPreview.presets}
                  caps={refundPreview.caps}
                  maxRefund={Number(refundTx?.amount) || undefined}
                />
              )
            ) : refundTx ? (
              <RefundSettlementFields
                state={refundSettlement}
                onChange={setRefundSettlement}
                presets={{
                  fullAmount: Number(refundTx.amount) || 0,
                  netItemsPackingAmount: Number(refundTx.amount) || 0,
                  itemTotal: 0,
                  packingTotal: 0,
                  discountAmount: 0,
                }}
                caps={{
                  maxRestaurantDeduction: 0,
                  maxPartnerDeduction: 0,
                  assignedPartnerId: null,
                  hasRestaurantCredit: false,
                  hasPartnerTripEarning: false,
                }}
                maxRefund={Number(refundTx.amount) || undefined}
                showWalletOptions={false}
              />
            ) : null}
            <div className="space-y-2">
              <Label className="text-white/50">Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Cancelled order / duplicate charge..."
                className="bg-black/20 border-white/10"
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-white/60 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={recordOnly}
                onChange={(e) => setRecordOnly(e.target.checked)}
              />
              <span>
                Record only (skip Razorpay API — use when refunded offline /
                already refunded in dashboard)
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-white/15"
              onClick={() => {
                setRefundOpen(false);
                setRefundTx(null);
                setReason("");
                setRecordOnly(false);
                setRefundSettlement(emptyRefundSettlementState());
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-sky-400 text-[#013644] font-semibold hover:bg-sky-300"
              disabled={
                refundMutation.isPending ||
                (!!refundOrderRef && (refundPreviewLoading || !refundPreview))
              }
              onClick={() => refundMutation.mutate()}
            >
              {refundMutation.isPending ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                "Confirm refund"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={raiseOpen} onOpenChange={setRaiseOpen}>
        <DialogContent className="bg-[#002833] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Raise paid order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-white/50">
              Use this when Razorpay captured a payment but the kitchen never got
              the order. The existing order is staged as awaiting payment, then
              confirmed — restaurant is alerted. Duplicate captures on the same
              payment are ignored.
            </p>
            <div className="space-y-2">
              <Label className="text-white/50">Pickfoo order id</Label>
              <Input
                value={raiseOrderId}
                onChange={(e) => setRaiseOrderId(e.target.value)}
                placeholder="PF-20260813-E8CFB1"
                className="bg-black/20 border-white/10 font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/50">Razorpay order id</Label>
              <Input
                value={raiseRpOrderId}
                onChange={(e) => setRaiseRpOrderId(e.target.value)}
                placeholder="order_..."
                className="bg-black/20 border-white/10 font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/50">Razorpay payment id</Label>
              <Input
                value={raiseRpPaymentId}
                onChange={(e) => setRaiseRpPaymentId(e.target.value)}
                placeholder="pay_..."
                className="bg-black/20 border-white/10 font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-white/15"
              onClick={() => setRaiseOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#98E32F] text-[#013644] font-semibold hover:bg-[#98E32F]"
              disabled={raiseRefsMutation.isPending}
              onClick={() => raiseRefsMutation.mutate()}
            >
              {raiseRefsMutation.isPending ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                "Raise order"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
