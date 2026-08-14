"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { raiseCustomerOrderFromRefs } from "@/lib/api/customer-payments";
import {
  cancelSourceLabel,
  fetchDispatchOrder,
  isPaidAwaitingPrep,
  markOrderRefunded,
  type AdminOrderDetail,
} from "@/lib/api/orders";
import {
  ArrowLeft,
  Bike,
  Loader2,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  Store,
  Undo2,
  User,
} from "lucide-react";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatMoney(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return money.format(value);
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: ReactNode;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-2 text-sm last:border-0">
      <span className="shrink-0 text-white/45">{label}</span>
      <span className="text-right text-white/90">{value}</span>
    </div>
  );
}

function PartyCard({
  title,
  icon,
  children,
  href,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  href?: string | null;
}) {
  return (
    <Card className="border-white/5 bg-[#002833] text-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {title}
          </CardTitle>
          {href ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-white/10 text-white/70 hover:bg-white/5"
            >
              <Link href={href}>Open</Link>
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-0 pt-0">{children}</CardContent>
    </Card>
  );
}

function TimelineCard({ order }: { order: AdminOrderDetail }) {
  const entries: Array<{ label: string; at?: string | null }> = [
    { label: "Created", at: order.timeline.createdAt || order.timeline.orderDate },
    { label: "Accepted for payment", at: order.timeline.acceptedForPaymentAt },
    { label: "Preparing started", at: order.timeline.preparingStartedAt },
    { label: "Estimated ready", at: order.timeline.estimatedReadyAt },
    { label: "Marked ready", at: order.timeline.readyAt },
    { label: "Last updated", at: order.timeline.updatedAt },
  ].filter((e) => e.at);

  return (
    <Card className="border-white/5 bg-[#002833] text-white">
      <CardHeader>
        <CardTitle className="text-base">Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-white/40">No timeline events yet.</p>
        ) : (
          entries.map((e) => (
            <div
              key={e.label}
              className="flex items-start justify-between gap-4 border-b border-white/5 pb-2 text-sm last:border-0 last:pb-0"
            >
              <span className="text-white/50">{e.label}</span>
              <span className="text-right text-white/85">{formatDate(e.at)}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderRef = String(params?.id || "").trim();
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");

  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: ["orders", "dispatch-order", orderRef],
    queryFn: () => fetchDispatchOrder(orderRef),
    enabled: !!orderRef,
  });

  const raiseMutation = useMutation({
    mutationFn: () => {
      if (!order?.customer?.id) {
        throw new Error("Customer is missing on this order");
      }
      return raiseCustomerOrderFromRefs(order.customer.id, {
        orderId: order.pickfooId || order.id,
        razorpayOrderId: order.razorpayOrderId || undefined,
        razorpayPaymentId:
          order.paymentReference || order.transactionId || undefined,
      });
    },
    onSuccess: (res) => {
      toast.success(
        res.alreadyRaised
          ? "Order was already raised"
          : "Order raised — restaurant alerted and marked confirmed",
      );
      queryClient.invalidateQueries({
        queryKey: ["orders", "dispatch-order", orderRef],
      });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : err instanceof Error
            ? err.message
            : undefined;
      toast.error(msg || "Could not raise order");
    },
  });

  const refundMutation = useMutation({
    mutationFn: () => markOrderRefunded(orderRef, refundReason),
    onSuccess: (res) => {
      const n = res.data?.transactionsUpdated ?? 0;
      toast.success(
        n > 0
          ? `Marked refunded · ${n} payment record${n === 1 ? "" : "s"} updated`
          : "Order marked as refunded",
      );
      setRefundOpen(false);
      setRefundReason("");
      queryClient.invalidateQueries({
        queryKey: ["orders", "dispatch-order", orderRef],
      });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : err instanceof Error
            ? err.message
            : undefined;
      toast.error(msg || "Could not mark refunded");
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          className="border-white/10 text-white"
          onClick={() => router.push("/orders")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to orders
        </Button>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardContent className="py-10 text-center text-white/50">
            {error instanceof Error ? error.message : "Order not found."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const awaitingPrep = isPaidAwaitingPrep({
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    orderType: order.orderType,
    createdAt: order.createdAt || new Date().toISOString(),
  });
  const title = order.pickfooId || order.id;
  const cancelSource = cancelSourceLabel(order);
  const canMarkRefunded = order.paymentStatus === "paid";
  const canCleanupRefundedDispatch =
    order.paymentStatus === "refunded" &&
    ["confirmed", "preparing", "ready", "out-for-delivery"].includes(
      order.status,
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 text-white"
            onClick={() => router.push("/orders")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Orders
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
            <p className="mt-1 text-sm text-white/50">
              {order.restaurant.name || "Restaurant"} · {formatDate(order.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-white/10 text-white/80">
              {order.orderType}
            </Badge>
            <div className="flex flex-col gap-0.5">
              <Badge variant="outline" className="border-white/10 text-white/80">
                {order.status}
              </Badge>
              {cancelSource ? (
                <span className="pl-0.5 text-[11px] font-medium text-red-300/90">
                  {cancelSource}
                </span>
              ) : null}
            </div>
            {order.paymentStatus ? (
              <Badge
                variant="outline"
                className={
                  order.paymentStatus === "paid"
                    ? "border-[#98E32F]/40 bg-[#98E32F]/10 text-[#98E32F]"
                    : order.paymentStatus === "refunded"
                      ? "border-sky-400/40 bg-sky-500/15 text-sky-300"
                      : "border-white/10 text-white/70"
                }
              >
                payment: {order.paymentStatus}
              </Badge>
            ) : null}
            {awaitingPrep ? (
              <Badge
                variant="outline"
                className="border-amber-500/50 bg-amber-500/20 text-amber-200"
              >
                Paid · start prep
              </Badge>
            ) : null}
            {canMarkRefunded || canCleanupRefundedDispatch ? (
              <Button
                size="sm"
                variant="outline"
                className="border-sky-400/40 text-sky-300 hover:bg-sky-500/10"
                onClick={() => setRefundOpen(true)}
              >
                <Undo2 className="mr-1 h-3.5 w-3.5" />
                {canCleanupRefundedDispatch
                  ? "Stop partner offers"
                  : "Mark refunded"}
              </Button>
            ) : null}
            {["payment-expired", "cancelled", "accepted-awaiting-payment"].includes(
              order.status,
            ) && order.customer?.id ? (
              <Button
                size="sm"
                variant="outline"
                className="border-[#98E32F]/40 text-[#98E32F] hover:bg-[#98E32F]/10"
                disabled={raiseMutation.isPending}
                onClick={() => raiseMutation.mutate()}
              >
                {raiseMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Megaphone className="mr-1 h-3.5 w-3.5" />
                )}
                Raise paid order
              </Button>
            ) : null}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#002833] px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-wide text-white/45">Total</p>
          <p className="text-2xl font-bold text-white">
            {formatMoney(order.totalAmount)}
          </p>
          <p className="text-xs text-[#98E32F]">
            Commission {formatMoney(order.platformCommission)}
            {order.commissionPercent > 0 ? ` (${order.commissionPercent}%)` : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PartyCard
          title="Customer"
          icon={<User className="h-4 w-4 text-[#98E32F]" />}
          href={order.customer?.id ? `/users/${order.customer.id}/payments` : null}
        >
          {order.customer ? (
            <>
              <DetailRow label="Name" value={order.customer.name || "—"} />
              <DetailRow
                label="Phone"
                value={
                  order.customer.phone ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-white/40" />
                      {order.customer.phone}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow
                label="Email"
                value={
                  order.customer.email ? (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5 text-white/40" />
                      {order.customer.email}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
            </>
          ) : (
            <p className="py-2 text-sm text-white/40">Customer not linked.</p>
          )}
        </PartyCard>

        <PartyCard
          title="Restaurant"
          icon={<Store className="h-4 w-4 text-[#98E32F]" />}
          href={
            order.restaurant.id
              ? `/restaurants/${order.restaurant.id}/ledger`
              : null
          }
        >
          <DetailRow label="Name" value={order.restaurant.name || "—"} />
          <DetailRow
            label="Phone"
            value={order.restaurant.contactNumber || "—"}
          />
          <DetailRow label="Email" value={order.restaurant.email || "—"} />
          <DetailRow
            label="Address"
            value={
              order.restaurant.address ? (
                <span className="inline-flex items-start gap-1 text-left">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
                  {order.restaurant.address}
                </span>
              ) : (
                "—"
              )
            }
          />
          <DetailRow
            label="Commission"
            value={`${order.restaurant.commissionPercent}%`}
          />
        </PartyCard>

        <PartyCard
          title="Delivery partner"
          icon={<Bike className="h-4 w-4 text-[#98E32F]" />}
          href={
            order.deliveryPartner?.id
              ? `/partners/${order.deliveryPartner.id}`
              : null
          }
        >
          {order.deliveryPartner ? (
            <>
              <DetailRow label="Name" value={order.deliveryPartner.name || "—"} />
              <DetailRow
                label="Phone"
                value={order.deliveryPartner.phone || "—"}
              />
              <DetailRow
                label="Progress"
                value={order.deliveryPartner.progress || "—"}
              />
              <DetailRow
                label="Assigned"
                value={formatDate(order.deliveryPartner.assignedAt)}
              />
              <DetailRow
                label="Live"
                value={
                  [
                    order.deliveryPartner.isOnline ? "online" : "offline",
                    order.deliveryPartner.onDuty ? "on duty" : "off duty",
                  ].join(" · ")
                }
              />
              {order.deliveryPartner.decision?.status ? (
                <DetailRow
                  label="Decision"
                  value={order.deliveryPartner.decision.status}
                />
              ) : null}
            </>
          ) : (
            <p className="py-2 text-sm text-white/40">No partner assigned.</p>
          )}
        </PartyCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-white/5 bg-[#002833] text-white lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
            <CardDescription className="text-white/45">
              {order.items.length} line item{order.items.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-white/60">Item</TableHead>
                  <TableHead className="text-white/60">Qty</TableHead>
                  <TableHead className="text-white/60">Price</TableHead>
                  <TableHead className="text-white/60">Packing</TableHead>
                  <TableHead className="text-right text-white/60">Line</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-white/40"
                    >
                      No items on this order.
                    </TableCell>
                  </TableRow>
                ) : (
                  order.items.map((item, idx) => (
                    <TableRow
                      key={`${item.menuItem || item.name}-${idx}`}
                      className="border-white/5 hover:bg-white/5"
                    >
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-white/70">{item.quantity}</TableCell>
                      <TableCell className="text-white/70">
                        {formatMoney(item.price)}
                      </TableCell>
                      <TableCell className="text-white/70">
                        {formatMoney(item.packingCharge)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(item.lineTotal)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader>
            <CardTitle className="text-base">Amounts</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="Items" value={formatMoney(order.itemTotal)} />
            <DetailRow label="Packing" value={formatMoney(order.packingTotal)} />
            <DetailRow label="Delivery" value={formatMoney(order.deliveryFee)} />
            <DetailRow
              label="Discount"
              value={formatMoney(order.discountAmount)}
            />
            <DetailRow label="Tip" value={formatMoney(order.tipAmount)} />
            <DetailRow label="SGST" value={formatMoney(order.sgstAmount)} />
            <DetailRow label="CGST" value={formatMoney(order.cgstAmount)} />
            <DetailRow label="GST" value={formatMoney(order.gstAmount)} />
            <DetailRow
              label="Commission"
              value={
                <span className="text-[#98E32F]">
                  {formatMoney(order.platformCommission)}
                  {order.commissionPercent > 0
                    ? ` (${order.commissionPercent}%)`
                    : ""}
                </span>
              }
            />
            <DetailRow
              label="Total"
              value={
                <span className="font-semibold">
                  {formatMoney(order.totalAmount)}
                </span>
              }
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader>
            <CardTitle className="text-base">Delivery & notes</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow
              label="Address"
              value={order.deliveryAddress || "—"}
            />
            {order.deliveryLat != null && order.deliveryLng != null ? (
              <DetailRow
                label="Coords"
                value={`${order.deliveryLat.toFixed(5)}, ${order.deliveryLng.toFixed(5)}`}
              />
            ) : null}
            <DetailRow label="Tier" value={order.deliveryTier || "—"} />
            <DetailRow
              label="Cutlery"
              value={order.includeCutlery ? "Yes" : "No"}
            />
            <DetailRow
              label="Cooking requests"
              value={order.cookingRequests || "—"}
            />
            <DetailRow
              label="Delivery instructions"
              value={order.deliveryInstructions || "—"}
            />
            {order.voiceInstructionUrl ? (
              <DetailRow
                label="Voice note"
                value={
                  <a
                    href={order.voiceInstructionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#98E32F] underline-offset-2 hover:underline"
                  >
                    Open
                  </a>
                }
              />
            ) : null}
            {order.addressImageUrl ? (
              <DetailRow
                label="Address photo"
                value={
                  <a
                    href={order.addressImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#98E32F] underline-offset-2 hover:underline"
                  >
                    Open
                  </a>
                }
              />
            ) : null}
            {cancelSource ? (
              <DetailRow label="Canceled by" value={cancelSource} />
            ) : null}
            {order.rejectionReason ? (
              <DetailRow label="Rejection" value={order.rejectionReason} />
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-white/5 bg-[#002833] text-white">
            <CardHeader>
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailRow label="Status" value={order.paymentStatus || "—"} />
              <DetailRow label="Method" value={order.paymentMethod || "—"} />
              <DetailRow
                label="Provider"
                value={order.paymentProvider || "—"}
              />
              <DetailRow
                label="Razorpay order"
                value={order.razorpayOrderId || "—"}
              />
              <DetailRow
                label="Payment ref"
                value={order.paymentReference || "—"}
              />
              <DetailRow
                label="Transaction"
                value={order.transactionId || "—"}
              />
              {order.refundedAt ? (
                <DetailRow
                  label="Refunded at"
                  value={formatDate(order.refundedAt)}
                />
              ) : null}
              {order.refundReason ? (
                <DetailRow label="Refund reason" value={order.refundReason} />
              ) : null}
              {canMarkRefunded || canCleanupRefundedDispatch ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-4 w-full border-sky-400/40 text-sky-300 hover:bg-sky-500/10"
                  onClick={() => setRefundOpen(true)}
                >
                  <Undo2 className="mr-1 h-3.5 w-3.5" />
                  {canCleanupRefundedDispatch
                    ? "Stop partner offers"
                    : "Mark refunded"}
                </Button>
              ) : null}
            </CardContent>
          </Card>
          <TimelineCard order={order} />
        </div>
      </div>

      <Dialog
        open={refundOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRefundOpen(false);
            setRefundReason("");
          }
        }}
      >
        <DialogContent className="border-white/10 bg-[#002833] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {canCleanupRefundedDispatch
                ? "Stop partner offers?"
                : "Mark as refunded?"}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {canCleanupRefundedDispatch
                ? "This order is already refunded but still in the kitchen/dispatch pipeline. This cancels it and withdraws the partner offer so partners stop getting notified."
                : "Records this order as refunded in admin. Does not call Razorpay — use this after you already refunded in the dashboard or offline. Linked customer payment records will also be marked refunded, and any partner offer will be cleared."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-white/50">Reason (optional)</Label>
            <Input
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Cancelled order / duplicate charge..."
              className="border-white/10 bg-black/20 text-white"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-white/10"
              onClick={() => {
                setRefundOpen(false);
                setRefundReason("");
              }}
              disabled={refundMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-sky-400 text-[#013644] font-semibold hover:bg-sky-300"
              disabled={refundMutation.isPending}
              onClick={() => refundMutation.mutate()}
            >
              {refundMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="mr-2 h-4 w-4" />
              )}
              {canCleanupRefundedDispatch
                ? "Stop partner offers"
                : "Mark refunded"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
