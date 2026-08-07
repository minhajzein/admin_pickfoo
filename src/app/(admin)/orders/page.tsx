"use client";

import { startTransition, useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  canRedispatchPickupOrder,
  fetchDispatchOrders,
  isPaidAwaitingPrep,
  redispatchOrder,
  type AdminOrderRow,
} from "@/lib/api/orders";
import { Eye, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ListPagination } from "@/components/ui/list-pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatMoney(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return money.format(value);
}

function redispatchReasonLabel(reason?: string): string {
  switch (reason) {
    case "not_pickup":
      return "This order is not a pickup order.";
    case "invalid_status":
      return "Order is not in preparing or ready status.";
    case "already_assigned":
      return "Order still has an assigned partner.";
    case "no_partner_available":
      return "No eligible partner is available right now.";
    case "Partner already accepted this order":
      return "Partner already accepted this order.";
    default:
      return reason || "Could not assign a new partner.";
  }
}

function AmountBreakdown({ row }: { row: AdminOrderRow }) {
  return (
    <div className="min-w-[11rem] space-y-0.5 text-xs leading-snug">
      <div className="flex justify-between gap-3 font-medium text-white">
        <span className="text-white/50">Total</span>
        <span>{formatMoney(row.totalAmount)}</span>
      </div>
      <div className="flex justify-between gap-3 text-white/70">
        <span className="text-white/40">Items</span>
        <span>{formatMoney(row.itemTotal)}</span>
      </div>
      <div className="flex justify-between gap-3 text-white/70">
        <span className="text-white/40">Packing</span>
        <span>{formatMoney(row.packingTotal)}</span>
      </div>
      <div className="flex justify-between gap-3 text-white/70">
        <span className="text-white/40">Delivery</span>
        <span>{formatMoney(row.deliveryFee)}</span>
      </div>
      <div className="flex justify-between gap-3 border-t border-white/10 pt-0.5 font-medium text-[#98E32F]">
        <span className="text-white/50">
          Commission
          {row.commissionPercent != null && row.commissionPercent > 0 ? (
            <span className="ml-1 text-[10px] font-normal text-white/35">
              ({row.commissionPercent}%)
            </span>
          ) : null}
        </span>
        <span>{formatMoney(row.platformCommission)}</span>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [redispatchingRef, setRedispatchingRef] = useState<string | null>(null);
  const [confirmRow, setConfirmRow] = useState<AdminOrderRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["orders", "dispatch-orders", page],
    queryFn: () => fetchDispatchOrders({ page, limit: DEFAULT_PAGE_SIZE }),
    refetchInterval: 15000,
    placeholderData: keepPreviousData,
  });

  const redispatchMutation = useMutation({
    mutationFn: (row: AdminOrderRow) => {
      const orderRef = row.pickfooId?.trim() || row.id;
      return redispatchOrder(orderRef, "Admin triggered redispatch");
    },
    onMutate: (row) => {
      setRedispatchingRef(row.pickfooId?.trim() || row.id);
      setConfirmRow(null);
    },
    onSettled: () => {
      setRedispatchingRef(null);
    },
    onSuccess: (result) => {
      // Don't block paint with a full list refetch + toast work.
      startTransition(() => {
        void queryClient.invalidateQueries({
          queryKey: ["orders", "dispatch-orders"],
        });
      });
      if (result.redispatched && result.partner) {
        toast.success(`Redispatched to ${result.partner.fullName}`, {
          description: result.partner.phone,
        });
        return;
      }
      toast.warning("Redispatch completed without a new partner", {
        description: redispatchReasonLabel(result.reason),
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to redispatch order";
      toast.error(message);
    },
  });

  const rows = useMemo(() => data?.data ?? [], [data]);
  const summary = data?.summary ?? {
    total: 0,
    active: 0,
    delivered: 0,
    cancelled: 0,
  };
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const awaitingPrepCount = useMemo(
    () => rows.filter(isPaidAwaitingPrep).length,
    [rows]
  );

  const confirmLabel = confirmRow
    ? confirmRow.pickfooId || confirmRow.id
    : "";
  const confirmAssigned = confirmRow
    ? confirmRow.deliveryPartnerName || confirmRow.assignedPartner
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Orders</h2>
        <p className="text-sm text-white/50">
          Live order activity stream from the admin monitor service.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Total orders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.total}</CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Active</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.active}</CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Cancellations</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {summary.cancelled}
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Delivered</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {summary.delivered}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-white/5 bg-[#002833] text-white">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Recent orders</CardTitle>
          {awaitingPrepCount > 0 ? (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/15 text-amber-200"
            >
              {awaitingPrepCount} paid · awaiting prep
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/60">Order</TableHead>
                <TableHead className="text-white/60">Type</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Amounts</TableHead>
                <TableHead className="text-white/60">Assigned partner</TableHead>
                <TableHead className="text-white/60">Partner progress</TableHead>
                <TableHead className="text-white/60">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#98E32F]" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-white/40"
                  >
                    No order activity events found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const orderRef = row.pickfooId?.trim() || row.id;
                  const showRedispatch = canRedispatchPickupOrder(row);
                  const isRedispatching = redispatchingRef === orderRef;
                  const awaitingPrep = isPaidAwaitingPrep(row);

                  return (
                    <TableRow
                      key={row.id}
                      className={
                        awaitingPrep
                          ? "border-l-2 border-l-amber-400 border-b-white/5 bg-amber-500/10 hover:bg-amber-500/15"
                          : "border-white/5 hover:bg-white/5"
                      }
                    >
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <Link
                            href={`/orders/${encodeURIComponent(orderRef)}`}
                            className="text-white hover:text-[#98E32F] hover:underline"
                          >
                            {row.pickfooId || row.id}
                          </Link>
                          <span className="text-xs font-normal text-white/40">
                            {new Date(row.createdAt).toLocaleString()}
                          </span>
                          {row.restaurantName ? (
                            <span className="text-xs font-normal text-white/45">
                              {row.restaurantName}
                            </span>
                          ) : null}
                          {awaitingPrep ? (
                            <Badge
                              variant="outline"
                              className="w-fit border-amber-500/50 bg-amber-500/20 text-[10px] uppercase tracking-wide text-amber-200"
                            >
                              Paid · start prep
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-white/10 text-white/80"
                        >
                          {row.orderType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-white/80">
                        <div className="flex flex-col gap-0.5">
                          <span>{row.status}</span>
                          {row.paymentStatus ? (
                            <span
                              className={
                                row.paymentStatus === "paid"
                                  ? "text-[11px] text-[#98E32F]/80"
                                  : "text-[11px] text-white/40"
                              }
                            >
                              payment: {row.paymentStatus}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <AmountBreakdown row={row} />
                      </TableCell>
                      <TableCell className="text-white/50">
                        {row.deliveryPartnerName ||
                          row.assignedPartner ||
                          "Unassigned"}
                      </TableCell>
                      <TableCell className="text-white/50">
                        {row.partnerDeliveryProgress || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            asChild
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-white/10 text-white hover:bg-white/5"
                          >
                            <Link
                              href={`/orders/${encodeURIComponent(orderRef)}`}
                            >
                              <Eye className="mr-1.5 h-3.5 w-3.5" />
                              Details
                            </Link>
                          </Button>
                          {showRedispatch ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-[#98E32F]/40 text-[#98E32F] hover:bg-[#98E32F]/10 hover:text-[#98E32F]"
                              disabled={
                                isRedispatching || redispatchMutation.isPending
                              }
                              onClick={() => setConfirmRow(row)}
                            >
                              {isRedispatching ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                  Redispatch
                                </>
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <ListPagination
            page={page}
            limit={DEFAULT_PAGE_SIZE}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <Dialog
        open={!!confirmRow}
        onOpenChange={(open) => {
          if (!open) setConfirmRow(null);
        }}
      >
        <DialogContent className="border-white/10 bg-[#002833] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redispatch order?</DialogTitle>
            <DialogDescription className="text-white/55">
              {confirmAssigned
                ? `This will withdraw the current offer from ${confirmAssigned} on order ${confirmLabel} and find another partner.`
                : `This will find another delivery partner for order ${confirmLabel}.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-white/15 text-white"
              onClick={() => setConfirmRow(null)}
              disabled={redispatchMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#98E32F] text-[#013644] hover:bg-[#86c926]"
              disabled={!confirmRow || redispatchMutation.isPending}
              onClick={() => {
                if (!confirmRow) return;
                redispatchMutation.mutate(confirmRow);
              }}
            >
              {redispatchMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm redispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
