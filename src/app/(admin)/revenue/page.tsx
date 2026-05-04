"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMonitorEvents } from "@/lib/api/monitor";
import type { AdminMonitorEvent } from "@/types/models";
import { Loader2 } from "lucide-react";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function RevenuePage() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["revenue", "monitor-events"],
    queryFn: () => fetchMonitorEvents({ limit: 500 }),
    refetchInterval: 30000,
  });

  const orderPayments = useMemo(() => getOrderPaymentEvents(events), [events]);
  const gross = orderPayments.reduce((sum, item) => sum + item.amount, 0);
  const avgTicket = orderPayments.length ? gross / orderPayments.length : 0;
  const todayGross = orderPayments
    .filter((item) => isToday(item.createdAt))
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Revenue</h2>
        <p className="text-sm text-white/50">
          Estimated live revenue based on order monitor events.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Gross (stream)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {money.format(gross)}
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Orders tracked</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {orderPayments.length}
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Avg order value</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {money.format(avgTicket)}
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Today (stream)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {money.format(todayGross)}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/5 bg-[#002833] text-white">
        <CardHeader>
          <CardTitle className="text-base">Data source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-white/70">
          {isLoading ? (
            <div className="py-6 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#98E32F]" />
            </div>
          ) : (
            <>
              <p>
                This page uses <Badge className="ml-1 bg-white/10 text-white">order:live:new-request</Badge>{" "}
                events from monitor logs. It keeps the revenue route available while
                dedicated finance endpoints are added.
              </p>
              <p className="text-white/50">
                Last seen payment event:{" "}
                {orderPayments[0]
                  ? new Date(orderPayments[0].createdAt).toLocaleString()
                  : "No payment events yet"}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getOrderPaymentEvents(events: AdminMonitorEvent[]) {
  return events
    .filter((event) => event.event === "order:live:new-request")
    .map((event) => {
      const payload = asObject(event.payload);
      const amount = asNumber(payload.totalAmount);
      return {
        createdAt: event.createdAt,
        amount: amount ?? 0,
      };
    })
    .filter((item) => item.amount > 0);
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isToday(rawDate: string): boolean {
  const date = new Date(rawDate);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
