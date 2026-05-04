"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchMonitorEvents } from "@/lib/api/monitor";
import type { AdminMonitorEvent } from "@/types/models";
import { Loader2 } from "lucide-react";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type OrderRow = {
  id: string;
  event: string;
  orderRef: string;
  status: string;
  amount: number | null;
  source: string;
  createdAt: string;
};

export default function OrdersPage() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["orders", "monitor-events"],
    queryFn: () => fetchMonitorEvents({ limit: 300 }),
    refetchInterval: 15000,
  });

  const rows = useMemo(() => toOrderRows(events), [events]);
  const liveUpdates = rows.filter((row) => row.event.startsWith("order:live:"));
  const cancellationCount = rows.filter((row) =>
    row.event.includes("cancel"),
  ).length;

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
            <CardTitle className="text-sm text-white/60">Tracked events</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{rows.length}</CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Live updates</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{liveUpdates.length}</CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Cancellations</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{cancellationCount}</CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Last event</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">
            {rows[0]?.createdAt
              ? new Date(rows[0].createdAt).toLocaleString()
              : "No activity yet"}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-white/5 bg-[#002833] text-white">
        <CardHeader>
          <CardTitle className="text-base">Recent order timeline</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/60">Order</TableHead>
                <TableHead className="text-white/60">Event</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Amount</TableHead>
                <TableHead className="text-white/60">Source</TableHead>
                <TableHead className="text-right text-white/60">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#98E32F]" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-white/40">
                    No order activity events found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-white/5 hover:bg-white/5"
                  >
                    <TableCell className="font-medium">{row.orderRef}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-white/10 text-white/80"
                      >
                        {row.event}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white/80">{row.status}</TableCell>
                    <TableCell className="font-medium">
                      {row.amount === null ? "—" : money.format(row.amount)}
                    </TableCell>
                    <TableCell className="text-white/50">{row.source}</TableCell>
                    <TableCell className="text-right text-xs text-white/50">
                      {new Date(row.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function toOrderRows(events: AdminMonitorEvent[]): OrderRow[] {
  return events
    .filter(
      (event) =>
        event.event.startsWith("order:") || event.event.startsWith("dispatch:"),
    )
    .slice(0, 120)
    .map((event) => {
      const payload = asObject(event.payload);
      const orderRef =
        asString(payload.orderId) ||
        asString(payload.pickfooId) ||
        asString(payload.orderRef) ||
        "Unknown";
      const status = asString(payload.status) || normalizeStatus(event.event);
      const amount = asNumber(payload.totalAmount);
      return {
        id: event.id,
        event: event.event,
        orderRef,
        status,
        amount,
        source: event.source || "system",
        createdAt: event.createdAt,
      };
    });
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeStatus(eventName: string): string {
  const raw = eventName.replace(/^order:/, "").replace(/^dispatch:/, "");
  return raw.replace(/-/g, " ");
}
