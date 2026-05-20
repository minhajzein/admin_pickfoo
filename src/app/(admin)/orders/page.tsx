"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  redispatchOrder,
  type AdminOrderRow,
} from "@/lib/api/orders";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

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
    default:
      return reason || "Could not assign a new partner.";
  }
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [redispatchingRef, setRedispatchingRef] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["orders", "dispatch-orders"],
    queryFn: () => fetchDispatchOrders({ limit: 300 }),
    refetchInterval: 15000,
  });

  const redispatchMutation = useMutation({
    mutationFn: (row: AdminOrderRow) => {
      const orderRef = row.pickfooId?.trim() || row.id;
      return redispatchOrder(orderRef, "Admin triggered redispatch");
    },
    onMutate: (row) => {
      setRedispatchingRef(row.pickfooId?.trim() || row.id);
    },
    onSettled: () => {
      setRedispatchingRef(null);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["orders", "dispatch-orders"] });
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

  const handleRedispatch = (row: AdminOrderRow) => {
    const label = row.pickfooId || row.id;
    const assigned = row.deliveryPartnerName || row.assignedPartner;
    const confirmed = window.confirm(
      assigned
        ? `Redispatch order ${label}? This will withdraw the current offer from ${assigned} and find another partner.`
        : `Redispatch order ${label}? This will find another delivery partner.`
    );
    if (!confirmed) return;
    redispatchMutation.mutate(row);
  };

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
          <CardContent className="text-2xl font-bold">{summary.cancelled}</CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Delivered</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.delivered}</CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-white/5 bg-[#002833] text-white">
        <CardHeader>
          <CardTitle className="text-base">Recent orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/60">Order</TableHead>
                <TableHead className="text-white/60">Type</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Amount</TableHead>
                <TableHead className="text-white/60">Assigned partner</TableHead>
                <TableHead className="text-white/60">Partner progress</TableHead>
                <TableHead className="text-white/60">Actions</TableHead>
                <TableHead className="text-right text-white/60">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#98E32F]" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-white/40">
                    No order activity events found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const orderRef = row.pickfooId?.trim() || row.id;
                  const showRedispatch = canRedispatchPickupOrder(row);
                  const isRedispatching = redispatchingRef === orderRef;

                  return (
                    <TableRow
                      key={row.id}
                      className="border-white/5 hover:bg-white/5"
                    >
                      <TableCell className="font-medium">
                        {row.pickfooId || row.id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-white/10 text-white/80">
                          {row.orderType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-white/80">{row.status}</TableCell>
                      <TableCell className="font-medium">
                        {row.totalAmount == null ? "—" : money.format(row.totalAmount)}
                      </TableCell>
                      <TableCell className="text-white/50">
                        {row.deliveryPartnerName || row.assignedPartner || "Unassigned"}
                      </TableCell>
                      <TableCell className="text-white/50">
                        {row.partnerDeliveryProgress || "—"}
                      </TableCell>
                      <TableCell>
                        {showRedispatch ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-[#98E32F]/40 text-[#98E32F] hover:bg-[#98E32F]/10 hover:text-[#98E32F]"
                            disabled={isRedispatching || redispatchMutation.isPending}
                            onClick={() => handleRedispatch(row)}
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
                        ) : (
                          <span className="text-xs text-white/30">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-white/50">
                        {new Date(row.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
