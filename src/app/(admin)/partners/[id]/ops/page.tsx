"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, Fragment } from "react";
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
import {
  fetchPartnerLedger,
  fetchPartnerLedgerTransactions,
} from "@/lib/api/partner-ledger";
import {
  fetchPartnerOpsOrders,
  fetchPartnerPresenceHours,
  formatDuration,
  formatKm,
  formatOfflineReason,
  formatSessionClock,
  type PartnerOpsOrderScope,
  type PartnerPresenceDay,
} from "@/lib/api/partner-ops";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { visibleRefetchInterval } from "@/lib/query-live";
import {
  ArrowLeft,
  Bike,
  ChevronDown,
  ChevronRight,
  Clock3,
  Loader2,
  Route,
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

function formatDayLabel(dayKey: string): string {
  try {
    const d = new Date(`${dayKey}T12:00:00`);
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dayKey;
  }
}

export default function PartnerOpsPage() {
  const params = useParams();
  const router = useRouter();
  const routeId = params?.id;
  const partnerId = Array.isArray(routeId) ? routeId[0] : routeId;

  const [scope, setScope] = useState<PartnerOpsOrderScope>("completed");
  const [page, setPage] = useState(1);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);

  const { data: partner, isLoading: partnerLoading } = useQuery({
    queryKey: ["partner", partnerId],
    queryFn: () => fetchPartner(String(partnerId)),
    enabled: Boolean(partnerId),
  });

  const { data: hours, isLoading: hoursLoading } = useQuery({
    queryKey: ["partner-ops", partnerId, "hours"],
    queryFn: () => fetchPartnerPresenceHours(String(partnerId), 30),
    enabled: Boolean(partnerId),
    refetchInterval: visibleRefetchInterval(60_000),
  });

  useEffect(() => {
    if (!hours?.today?.dayKey) return;
    setSelectedDayKey((prev) => prev ?? hours.today.dayKey);
    setExpandedDayKey((prev) => prev ?? hours.today.dayKey);
  }, [hours?.today?.dayKey]);

  const selectedDay: PartnerPresenceDay | null = useMemo(() => {
    if (!hours?.days?.length) return null;
    const key = selectedDayKey ?? hours.today.dayKey;
    return hours.days.find((d) => d.dayKey === key) ?? hours.today;
  }, [hours, selectedDayKey]);

  const { data: dayEarnings, isLoading: dayEarningsLoading } = useQuery({
    queryKey: ["partner-ops", partnerId, "day-earnings", selectedDay?.dayKey],
    queryFn: () =>
      fetchPartnerLedgerTransactions(String(partnerId), {
        type: "trip_earning",
        from: selectedDay!.dayKey,
        to: selectedDay!.dayKey,
        limit: 200,
      }),
    enabled: Boolean(partnerId && selectedDay?.dayKey),
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
              Day-by-day online/offline sessions, km run, and earnings
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
            <CardTitle className="text-sm text-white/60">Today km</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {hoursLoading ? "…" : formatKm(hours?.today.kmRun ?? 0)}
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">
              Today earnings
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-[#98E32F]">
            {hoursLoading
              ? "…"
              : money.format(hours?.today.earningsInr ?? 0)}
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
              Daily report (last 30 days)
            </CardTitle>
            <CardDescription className="text-white/45">
              Tap a day for online/offline timeline, earnings, and km. Online =
              available · On duty = delivery
              {hours ? (
                <>
                  {" "}
                  · Period {formatDuration(hours.totals.onlineSeconds)} online ·{" "}
                  {formatKm(hours.totals.kmRun ?? 0)} ·{" "}
                  {money.format(hours.totals.earningsInr ?? 0)} earned
                </>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="w-8 text-white/60" />
                  <TableHead className="text-white/60">Day</TableHead>
                  <TableHead className="text-white/60">Online</TableHead>
                  <TableHead className="text-white/60">On duty</TableHead>
                  <TableHead className="text-white/60">Km</TableHead>
                  <TableHead className="text-white/60">Earnings</TableHead>
                  <TableHead className="text-white/60">Offline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hoursLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#98E32F]" />
                    </TableCell>
                  </TableRow>
                ) : (hours?.days.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-white/40"
                    >
                      No presence data yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  hours!.days.map((day) => {
                    const expanded = expandedDayKey === day.dayKey;
                    const selected = selectedDayKey === day.dayKey;
                    return (
                      <Fragment key={day.dayKey}>
                        <TableRow
                          className={`cursor-pointer border-white/5 hover:bg-white/5 ${
                            selected ? "bg-white/[0.04]" : ""
                          }`}
                          onClick={() => {
                            setSelectedDayKey(day.dayKey);
                            setExpandedDayKey(
                              expanded ? null : day.dayKey
                            );
                          }}
                        >
                          <TableCell className="pr-0 text-white/50">
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatDayLabel(day.dayKey)}
                          </TableCell>
                          <TableCell className="text-white/80">
                            {formatDuration(day.onlineSeconds)}
                          </TableCell>
                          <TableCell className="text-white/80">
                            {formatDuration(day.onDutySeconds)}
                          </TableCell>
                          <TableCell className="text-white/80">
                            {formatKm(day.kmRun ?? 0)}
                          </TableCell>
                          <TableCell className="text-[#98E32F]">
                            {money.format(day.earningsInr ?? 0)}
                          </TableCell>
                          <TableCell className="text-white/60">
                            {day.offlineCount ?? 0}
                          </TableCell>
                        </TableRow>
                        {expanded ? (
                          <TableRow className="border-white/5 bg-black/20 hover:bg-black/20">
                            <TableCell colSpan={7} className="px-4 py-4">
                              <DaySessionsPanel day={day} />
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-white/5 bg-[#002833] text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Route className="h-4 w-4 text-[#98E32F]" />
                Selected day
              </CardTitle>
              <CardDescription className="text-white/45">
                {selectedDay
                  ? formatDayLabel(selectedDay.dayKey)
                  : "Pick a day from the table"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {hoursLoading || !selectedDay ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#98E32F]" />
                </div>
              ) : (
                <>
                  <div className="flex justify-between gap-3 border-b border-white/5 py-2">
                    <span className="text-white/45">Online</span>
                    <span>
                      {formatDuration(selectedDay.onlineSeconds)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-white/5 py-2">
                    <span className="text-white/45">On duty</span>
                    <span>
                      {formatDuration(selectedDay.onDutySeconds)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-white/5 py-2">
                    <span className="text-white/45">Km run (GPS)</span>
                    <span>{formatKm(selectedDay.distanceKm ?? 0)}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-white/5 py-2">
                    <span className="text-white/45">Trip legs</span>
                    <span>{formatKm(selectedDay.tripDistanceKm ?? 0)}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-white/5 py-2">
                    <span className="text-white/45">Earnings</span>
                    <span className="text-[#98E32F]">
                      {money.format(selectedDay.earningsInr ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-white/5 py-2">
                    <span className="text-white/45">Tips</span>
                    <span>{money.format(selectedDay.tipsInr ?? 0)}</span>
                  </div>
                  <div className="flex justify-between gap-3 py-2">
                    <span className="text-white/45">Paid trips</span>
                    <span>{selectedDay.tripCount ?? 0}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-[#002833] text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4 text-[#98E32F]" />
                Earnings that day
              </CardTitle>
              <CardDescription className="text-white/45">
                Trip credits filtered to the selected day
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[320px] space-y-2 overflow-y-auto text-sm">
              {dayEarningsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#98E32F]" />
                </div>
              ) : (dayEarnings?.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-white/40">
                  No trip earnings on this day.
                </p>
              ) : (
                dayEarnings!.map((entry) => (
                  <div
                    key={entry._id}
                    className="flex items-start justify-between gap-3 border-b border-white/5 py-2 last:border-0"
                  >
                    <div>
                      <div className="font-medium text-white/90">
                        {entry.pickfooId || entry.orderId || "Trip"}
                      </div>
                      <div className="text-xs text-white/40">
                        {formatWhen(entry.createdAt)}
                        {entry.meta?.tipAmount
                          ? ` · tip ${money.format(entry.meta.tipAmount)}`
                          : ""}
                      </div>
                    </div>
                    <div className="font-semibold text-[#98E32F]">
                      {money.format(entry.amount)}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
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

function DaySessionsPanel({ day }: { day: PartnerPresenceDay }) {
  const sessions = day.sessions ?? [];
  if (!sessions.length) {
    return (
      <p className="text-sm text-white/40">
        No online / on-duty sessions recorded for this day yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">
        Online / offline timeline
      </p>
      {sessions.map((session, idx) => {
        const isOnline = session.kind === "online";
        const range = session.active
          ? `${formatSessionClock(session.startedAt)} – now`
          : `${formatSessionClock(session.startedAt)} – ${formatSessionClock(session.endedAt)}`;
        return (
          <div
            key={`${session.kind}-${session.startedAt}-${idx}`}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    isOnline
                      ? "border-[#98E32F]/35 text-[#98E32F]"
                      : "border-cyan-400/35 text-cyan-300"
                  }
                >
                  {isOnline
                    ? session.active
                      ? "Online now"
                      : "Online"
                    : session.active
                      ? "On duty now"
                      : "On duty"}
                </Badge>
                <span className="text-sm text-white/70">{range}</span>
              </div>
              <span className="text-xs text-white/45">
                {formatDuration(session.durationSeconds)}
              </span>
            </div>
            {isOnline && !session.active ? (
              <p className="mt-1 text-xs text-amber-300/90">
                {formatOfflineReason(session.endReason)}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
