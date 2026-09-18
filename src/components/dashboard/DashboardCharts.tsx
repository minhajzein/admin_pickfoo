"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchDashboardAnalytics } from "@/lib/api/dashboardAnalytics";
import { visibleRefetchInterval } from "@/lib/query-live";
import { Loader2 } from "lucide-react";

const ORDERS_COLOR = "#ef4444";
const REVENUE_COLOR = "#3b82f6";
const BAR_COLOR = "#f59e0b";
const SHARE_COLORS = [
  "#f97316",
  "#eab308",
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#ec4899",
  "#6b7280",
];

const moneyFmt = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

const moneyExact = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

function formatDayLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { month: "short", day: "2-digit" });
}

function formatRangeLabel(from: string, to: string) {
  if (!from || !to) return "";
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return `${from} – ${to}`;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const sameYear = a.getFullYear() === b.getFullYear();
  return `${a.toLocaleDateString("en-IN", opts)} – ${b.toLocaleDateString("en-IN", {
    ...opts,
    ...(sameYear ? {} : { year: "numeric" }),
  })}`;
}

function ChartTooltipShell({
  active,
  label,
  children,
}: {
  active?: boolean;
  label?: string;
  children: ReactNode;
}) {
  if (!active) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-black/90 px-3 py-2 text-xs text-white shadow-xl">
      {label ? <p className="mb-1.5 font-semibold">{label}</p> : null}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function DashboardCharts() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-analytics"],
    queryFn: () => fetchDashboardAnalytics(),
    refetchInterval: visibleRefetchInterval(120_000),
  });

  const daily = useMemo(
    () =>
      (data?.daily ?? []).map((row) => ({
        ...row,
        label: formatDayLabel(row.date),
      })),
    [data?.daily],
  );

  const share = data?.revenueShare ?? [];
  const leaderboard = data?.leaderboard ?? [];
  const rangeLabel = formatRangeLabel(data?.from ?? "", data?.to ?? "");
  const monthHint = useMemo(() => {
    if (!data?.to) return "this period";
    const d = new Date(`${data.to}T12:00:00`);
    if (Number.isNaN(d.getTime())) return "this period";
    return d.toLocaleDateString("en-IN", { month: "long" });
  }, [data?.to]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-white/5 bg-[#002833] py-16">
        <Loader2 className="h-7 w-7 animate-spin text-[#98E32F]" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-white/5 bg-[#002833] text-white">
        <CardContent className="py-10 text-center text-sm text-white/50">
          Could not load growth charts. Check admin-api `/dispatch/analytics`.
        </CardContent>
      </Card>
    );
  }

  const empty = !daily.some((d) => d.orders > 0 || d.revenue > 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-white/40">
          Pickfoo — Growth report{rangeLabel ? ` · ${rangeLabel}` : ""}
        </p>
      </div>

      <Card className="border-white/5 bg-[#002833] text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Daily order &amp; revenue trend</CardTitle>
          <p className="text-sm text-white/50">
            Full {rangeLabel || "selected"} timeline
            {empty ? ". No countable orders in this range yet." : "."}
          </p>
        </CardHeader>
        <CardContent className="h-[360px] pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={daily} margin={{ top: 8, right: 12, left: 0, bottom: 28 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                interval="preserveStartEnd"
                angle={-90}
                textAnchor="end"
                height={56}
                tickMargin={8}
              />
              <YAxis
                yAxisId="orders"
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                label={{
                  value: "Orders",
                  angle: -90,
                  position: "insideLeft",
                  fill: "rgba(255,255,255,0.45)",
                  fontSize: 11,
                }}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="revenue"
                orientation="right"
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                tickFormatter={(v) => moneyFmt.format(Number(v))}
                label={{
                  value: "Revenue ₹",
                  angle: 90,
                  position: "insideRight",
                  fill: "rgba(255,255,255,0.45)",
                  fontSize: 11,
                }}
              />
              <Tooltip
                content={({ active, label, payload }) => (
                  <ChartTooltipShell active={active} label={String(label ?? "")}>
                    {(payload ?? []).map((p) => (
                      <div key={String(p.dataKey)} className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ background: String(p.color) }}
                        />
                        <span>
                          {p.dataKey === "orders" ? "Orders" : "Revenue (₹)"}:{" "}
                          {p.dataKey === "orders"
                            ? Number(p.value ?? 0)
                            : moneyExact.format(Number(p.value ?? 0))}
                        </span>
                      </div>
                    ))}
                  </ChartTooltipShell>
                )}
              />
              <Legend
                wrapperStyle={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}
                formatter={(value) =>
                  value === "orders" ? "Orders" : "Revenue (₹)"
                }
              />
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                fill={`${REVENUE_COLOR}22`}
                stroke="transparent"
                legendType="none"
              />
              <Line
                yAxisId="orders"
                type="monotone"
                dataKey="orders"
                name="orders"
                stroke={ORDERS_COLOR}
                strokeWidth={2.5}
                dot={{ r: 3, fill: ORDERS_COLOR, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                name="revenue"
                stroke={REVENUE_COLOR}
                strokeWidth={2.5}
                dot={{ r: 3, fill: REVENUE_COLOR, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">
              Where {monthHint}&apos;s revenue actually comes from
            </CardTitle>
            <p className="text-sm text-white/50">
              Top 6 restaurants + &quot;everyone else&quot; — share of total collections
            </p>
          </CardHeader>
          <CardContent>
            {share.length === 0 ? (
              <p className="py-12 text-center text-sm text-white/40">No restaurant revenue yet.</p>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={share}
                        dataKey="revenue"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={2}
                        stroke="transparent"
                      >
                        {share.map((_, i) => (
                          <Cell
                            key={share[i]?.name ?? i}
                            fill={SHARE_COLORS[i % SHARE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          const row = payload?.[0]?.payload as
                            | { name?: string; revenue?: number; share?: number }
                            | undefined;
                          if (!active || !row) return null;
                          return (
                            <ChartTooltipShell active label={row.name}>
                              <div>
                                ₹{moneyExact.format(Number(row.revenue ?? 0))}
                                {row.share != null
                                  ? ` · ${(Number(row.share) * 100).toFixed(1)}%`
                                  : ""}
                              </div>
                            </ChartTooltipShell>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex w-full flex-wrap justify-center gap-x-4 gap-y-2">
                  {share.map((item, i) => (
                    <div
                      key={`${item.name}-${i}`}
                      className="flex items-center gap-2 text-xs text-white/70"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: SHARE_COLORS[i % SHARE_COLORS.length] }}
                      />
                      <span className="max-w-[160px] truncate">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Restaurant leaderboard</CardTitle>
            <p className="text-sm text-white/50">
              Revenue by restaurant{rangeLabel ? `, ${rangeLabel}` : ""}
            </p>
          </CardHeader>
          <CardContent className="h-[340px] pt-2">
            {leaderboard.length === 0 ? (
              <p className="py-12 text-center text-sm text-white/40">No restaurant revenue yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={[...leaderboard].reverse()}
                  margin={{ top: 4, right: 16, left: 8, bottom: 8 }}
                >
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                    tickFormatter={(v) => moneyFmt.format(Number(v))}
                    angle={-35}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 11 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      const row = payload?.[0]?.payload as
                        | { name?: string; revenue?: number; orders?: number }
                        | undefined;
                      if (!active || !row) return null;
                      return (
                        <ChartTooltipShell active label={row.name}>
                          <div>Revenue: ₹{moneyExact.format(Number(row.revenue ?? 0))}</div>
                          <div>Orders: {Number(row.orders ?? 0)}</div>
                        </ChartTooltipShell>
                      );
                    }}
                  />
                  <Bar dataKey="revenue" fill={BAR_COLOR} radius={[0, 8, 8, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
