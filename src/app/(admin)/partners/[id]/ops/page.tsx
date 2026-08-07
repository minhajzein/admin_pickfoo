"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchPartner } from "@/lib/api/partners";
import { fetchPartnerLedger } from "@/lib/api/partner-ledger";
import {
  fetchPartnerOpsOrders,
  fetchPartnerPresenceHours,
  formatDuration,
  type PartnerOpsOrderScope,
} from "@/lib/api/partner-ops";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import {
  ArrowLeft,
  Bike,
  Clock3,
  Loader2,
  ShieldCheck,
  Wallet,
} from "lucide-react";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const ORDER_TABS: Array<{ label: string; value: PartnerOpsOrderScope }> = [
  { label: "Completed", value: "completed" },
  { label: "Missed", value: "missed" },
  { label: "Rejected", value: "rejected" },
  { label: "Active", value: "active" },
];

function formatWhen(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function PartnerOpsPage() {
  const params = useParams();
  const router = useRouter();
  const routeId = params?.id;
  const partnerId = Array.isArray(routeId) ? routeId[0] : routeId;

  const [scope, setScope] = useState<PartnerOpsOrderScope>("completed");
  const [page, setPage] = useState(1);

  const { data: partner, isLoading: partnerLoading } = useQuery({
    queryKey: ["partner", partnerId],
    queryFn: () => fetchPartner(String(partnerId)),
    enabled: Boolean(partnerId),
  });

  const { data: hours, isLoading: hoursLoading } = useQuery({
    queryKey: ["partner-ops", partnerId, "hours"],
    queryFn: () => fetchPartnerPresenceHours(String(partnerId), 14),
    enabled: Boolean(partnerId),
    refetchInterval: 60_000,
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["partner-ops", partnerId, "orders", scope, page],
    queryFn: () =>
      fetchPartnerOpsOrders(String(partnerId), {
        scope,
        page,
        limit: DEFAULT_PAGE_SIZE,
      }),
    enabled: Boolean(partnerId),
    placeholderData: keepPreviousData,
  });

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["partner-ledger", partnerId],
    queryFn: () => fetchPartnerLedger(String(partnerId)),
    enabled: Boolean(partnerId),
  });

  if (partnerLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          className="border-white/10 text-white"
          onClick={() => router.push("/partners")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Partners
        </Button>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardContent className="py-10 text-center text-white/50">
            Partner not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = ordersData?.summary ?? {
    completed: 0,
    missed: 0,
    rejected: 0,
    active: 0,
    deliveredOrderCount: partner.deliveredOrderCount ?? 0,
  };
  const rows = ordersData?.data ?? [];
  const wallet = ledger?.summary;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="icon"
            className="border-white/10 text-white hover:bg-white/5"
            onClick={() => router.push("/partners")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-3xl font-bold tracking-tight">
                {partner.fullName}
              </h2>
              <Badge variant="outline" className="border-white/10 text-white/80">
                {partner.status}
              </Badge>
              <Badge
                variant="outline"
                className={
                  partner.isOnline
                    ? "border-[#98E32F]/40 text-[#98E32F]"
                    : "border-white/10 text-white/45"
                }
              >
                {partner.isOnline ? "online" : "offline"}
              </Badge>
              <Badge
                variant="outline"
                className={
                  partner.onDuty
                    ? "border-cyan-400/40 text-cyan-300"
                    : "border-white/10 text-white/45"
                }
              >
                {partner.onDuty ? "on duty" : "off duty"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-white/50">
              Hours, order outcomes, and wallet overview
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="outline"
            className="border-white/10 text-white hover:bg-white/5"
          >
            <Link href={`/partners/${partnerId}`}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Verification
            </Link>
          </Button>
          <Button
            asChild
            className="bg-[#98E32F] text-[#013644] hover:brightness-110 font-bold"
          >
            <Link href={`/partners/${partnerId}/ledger`}>
              <Wallet className="mr-2 h-4 w-4" />
              Full ledger
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Today online</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {hoursLoading
              ? "…"
              : formatDuration(hours?.today.onlineSeconds ?? 0)}
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Today on duty</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {hoursLoading
              ? "…"
              : formatDuration(hours?.today.onDutySeconds ?? 0)}
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Completed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {summary.completed}
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Missed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-amber-300">
            {summary.missed}
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Rejected</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-red-300">
            {summary.rejected}
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Wallet</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-[#98E32F]">
            {ledgerLoading
              ? "…"
              : money.format(wallet?.availableBalance ?? 0)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-white/5 bg-[#002833] text-white lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4 text-[#98E32F]" />
              Hours (last 14 days)
            </CardTitle>
            <CardDescription className="text-white/45">
              Online = available for offers · On duty = active delivery
              {hours ? (
                <>
                  {" "}
                  · Lifetime {formatDuration(hours.totals.onlineSeconds)} online
                  / {formatDuration(hours.totals.onDutySeconds)} on duty
                </>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-white/60">Day</TableHead>
                  <TableHead className="text-white/60">Online</TableHead>
                  <TableHead className="text-white/60">On duty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hoursLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#98E32F]" />
                    </TableCell>
                  </TableRow>
                ) : (hours?.days.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="py-8 text-center text-white/40"
                    >
                      No presence data yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  hours!.days.map((day) => (
                    <TableRow
                      key={day.dayKey}
                      className="border-white/5 hover:bg-white/5"
                    >
                      <TableCell className="font-medium">{day.dayKey}</TableCell>
                      <TableCell className="text-white/80">
                        {formatDuration(day.onlineSeconds)}
                      </TableCell>
                      <TableCell className="text-white/80">
                        {formatDuration(day.onDutySeconds)}
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
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-[#98E32F]" />
              Wallet details
            </CardTitle>
            <CardDescription className="text-white/45">
              Partner pocket = delivery fee + tip (not order total). Duplicate
              trip credits are removed automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {ledgerLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-[#98E32F]" />
              </div>
            ) : (
              <>
                <div className="flex justify-between gap-3 border-b border-white/5 py-2">
                  <span className="text-white/45">Available (spendable)</span>
                  <span className="font-medium text-[#98E32F]">
                    {money.format(wallet?.availableBalance ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/5 py-2">
                  <span className="text-white/45">Pending withdrawal</span>
                  <span>{money.format(wallet?.pendingWithdrawal ?? 0)}</span>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/5 py-2">
                  <span className="text-white/45">Trip earnings</span>
                  <span>{money.format(wallet?.lifetimeEarnings ?? 0)}</span>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/5 py-2">
                  <span className="text-white/45">This week</span>
                  <span>{money.format(wallet?.weekEarnings ?? 0)}</span>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/5 py-2">
                  <span className="text-white/45">Tips</span>
                  <span>{money.format(wallet?.tipsTotal ?? 0)}</span>
                </div>
                <div className="flex justify-between gap-3 py-2">
                  <span className="text-white/45">Paid trips</span>
                  <span>
                    {wallet?.completedOrderCount ?? wallet?.tripCount ?? 0}
                  </span>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="mt-2 w-full border-white/10 text-white hover:bg-white/5"
                >
                  <Link href={`/partners/${partnerId}/ledger`}>
                    Open full ledger
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-white/5 bg-[#002833] text-white">
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bike className="h-4 w-4 text-[#98E32F]" />
              Orders
            </CardTitle>
            <CardDescription className="text-white/45">
              Missed / rejected lists only include offers still recorded on the
              order (redispatched offers may drop older decisions).
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {ORDER_TABS.map((tab) => {
              const count =
                tab.value === "completed"
                  ? summary.completed
                  : tab.value === "missed"
                    ? summary.missed
                    : tab.value === "rejected"
                      ? summary.rejected
                      : summary.active;
              return (
                <Button
                  key={tab.value}
                  size="sm"
                  variant={scope === tab.value ? "default" : "outline"}
                  className={
                    scope === tab.value
                      ? "bg-[#98E32F] text-[#013644] hover:bg-[#86c926]"
                      : "border-white/10 text-white hover:bg-white/5"
                  }
                  onClick={() => {
                    setScope(tab.value);
                    setPage(1);
                  }}
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs opacity-70">{count}</span>
                </Button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/60">Order</TableHead>
                <TableHead className="text-white/60">Restaurant</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Progress / reason</TableHead>
                <TableHead className="text-right text-white/60">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#98E32F]" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-white/40"
                  >
                    No {scope} orders found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-white/5 hover:bg-white/5"
                  >
                    <TableCell className="font-medium">
                      <Link
                        href={`/orders/${encodeURIComponent(row.pickfooId || row.id)}`}
                        className="hover:text-[#98E32F] hover:underline"
                      >
                        {row.pickfooId || row.id}
                      </Link>
                      <div className="text-xs font-normal text-white/40">
                        {row.orderType || "—"}
                        {row.totalAmount != null
                          ? ` · ${money.format(row.totalAmount)}`
                          : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-white/70">
                      {row.restaurantName || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-white/10 text-white/80"
                      >
                        {row.status || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] text-sm text-white/65">
                      {row.partnerDecision?.reason ||
                        row.partnerDeliveryProgress ||
                        "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-white/50">
                      {formatWhen(
                        row.partnerDecision?.decidedAt ||
                          row.partnerAssignedAt ||
                          row.createdAt
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <ListPagination
            page={page}
            limit={DEFAULT_PAGE_SIZE}
            total={ordersData?.total ?? 0}
            totalPages={ordersData?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
