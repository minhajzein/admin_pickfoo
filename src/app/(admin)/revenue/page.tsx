"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchDispatchOrders } from "@/lib/api/orders";
import { Loader2 } from "lucide-react";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function RevenuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["revenue", "dispatch-orders"],
    queryFn: () => fetchDispatchOrders({ limit: 500 }),
    refetchInterval: 30000,
  });

  const rows = useMemo(() => data?.data ?? [], [data]);
  const countable = useMemo(
    () =>
      rows.filter(
        (row) => row.status !== "cancelled" && row.status !== "rejected",
      ),
    [rows],
  );

  const platformCommission =
    data?.summary.platformCommission ??
    countable.reduce((sum, row) => sum + (row.platformCommission ?? 0), 0);

  const todayCommission = countable
    .filter((row) => isToday(row.createdAt))
    .reduce((sum, row) => sum + (row.platformCommission ?? 0), 0);

  const avgCommission = countable.length
    ? platformCommission / countable.length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Company income</h2>
        <p className="text-sm text-white/50">
          Platform commission only — restaurant item totals are not included.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">
              Platform commission
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-[#98E32F]" />
            ) : (
              money.format(platformCommission)
            )}
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Orders tracked</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {isLoading ? "—" : countable.length}
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">
              Avg commission / order
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {isLoading ? "—" : money.format(avgCommission)}
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Today</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {isLoading ? "—" : money.format(todayCommission)}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/5 bg-[#002833] text-white">
        <CardHeader>
          <CardTitle className="text-base">How this is calculated</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-white/70">
          <p>
            Company income = food item amount × that restaurant&apos;s commission %.
            Packing charges, delivery fees, and tips are excluded. Cancelled and
            rejected orders are not counted.
          </p>
          <p className="text-white/50">
            Last order:{" "}
            {rows[0]
              ? new Date(rows[0].createdAt).toLocaleString()
              : "No orders yet"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
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
