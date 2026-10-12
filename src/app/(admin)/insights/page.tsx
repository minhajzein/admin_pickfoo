"use client";

import { Suspense, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, Loader2, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchInsights,
  type InsightItemBase,
  type InsightRestaurant,
  type Insights,
} from "@/lib/api/analytics";
import { searchRestaurants } from "@/lib/api/restaurants";
import { visibleRefetchInterval } from "@/lib/query-live";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const count = new Intl.NumberFormat("en-IN");
const pct = (v: number) => `${Math.round(v * 100)}%`;

const PRESETS = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

function localYmd(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function presetRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { from: localYmd(from), to: localYmd(to) };
}

const STATUS_LABELS: Record<string, string> = {
  delivered: "Delivered",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  "out-for-delivery": "Out for delivery",
  cancelled: "Cancelled",
  rejected: "Rejected by restaurant",
  "payment-expired": "Payment expired",
  "awaiting-owner": "Awaiting restaurant",
  "accepted-awaiting-payment": "Awaiting payment",
};

export default function InsightsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#98E32F]" />
        </div>
      }
    >
      <InsightsContent />
    </Suspense>
  );
}

function InsightsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const restaurantId = params.get("restaurantId") ?? "";
  const initial = presetRange(30);
  const [from, setFrom] = useState(params.get("from") ?? initial.from);
  const [to, setTo] = useState(params.get("to") ?? initial.to);

  const setRestaurant = (id: string) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("restaurantId", id);
    else next.delete("restaurantId");
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`);
  };

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["insights", from, to, restaurantId],
    queryFn: () => fetchInsights({ from, to, restaurantId }),
    refetchInterval: visibleRefetchInterval(120_000),
  });

  const { data: restaurantOptions = [] } = useQuery({
    queryKey: ["insights-restaurant-options"],
    queryFn: () => searchRestaurants({ limit: 200 }),
    staleTime: 5 * 60_000,
  });

  const restaurantName =
    data?.restaurant?.name ||
    restaurantOptions.find((r) => r._id === restaurantId)?.name ||
    "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          {restaurantId ? (
            <button
              type="button"
              onClick={() => setRestaurant("")}
              className="mb-2 flex items-center gap-1 text-xs text-white/50 hover:text-[#98E32F]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All restaurants
            </button>
          ) : null}
          <h1 className="text-3xl font-bold tracking-tight">
            {restaurantId ? restaurantName || "Restaurant insights" : "Insights"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            {restaurantId
              ? "Best sellers, cart activity, ratings and order patterns for this restaurant."
              : "What customers order, add to cart and rate across Pickfoo. Pick a restaurant for its own metrics."}
            {isFetching && !isLoading ? " Updating…" : ""}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const r = presetRange(p.days);
              const active = r.from === from && r.to === to;
              return (
                <Chip
                  key={p.days}
                  active={active}
                  label={p.label}
                  onClick={() => {
                    setFrom(r.from);
                    setTo(r.to);
                  }}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => e.target.value && setFrom(e.target.value)}
              className="w-38 border-white/10 bg-white/5 text-white"
            />
            <span className="text-white/40">–</span>
            <Input
              type="date"
              value={to}
              min={from}
              onChange={(e) => e.target.value && setTo(e.target.value)}
              className="w-38 border-white/10 bg-white/5 text-white"
            />
          </div>
          <select
            value={restaurantId}
            onChange={(e) => setRestaurant(e.target.value)}
            className="h-9 rounded-md border border-white/10 bg-[#002833] px-3 text-sm text-white"
          >
            <option value="">All restaurants</option>
            {restaurantOptions.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isError ? (
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardContent className="py-10 text-center text-sm text-red-300">
            Could not load insights. Check admin-api `/analytics/insights`.
          </CardContent>
        </Card>
      ) : isLoading || !data ? (
        <div className="flex items-center justify-center rounded-xl border border-white/5 bg-[#002833] py-20">
          <Loader2 className="h-7 w-7 animate-spin text-[#98E32F]" />
        </div>
      ) : (
        <InsightsBody data={data} onPickRestaurant={setRestaurant} />
      )}
    </div>
  );
}

function InsightsBody({
  data,
  onPickRestaurant,
}: {
  data: Insights;
  onPickRestaurant: (id: string) => void;
}) {
  const t = data.totals;
  const single = Boolean(data.restaurant);
  const daily = useMemo(
    () =>
      data.daily.map((d) => ({
        ...d,
        label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-IN", {
          month: "short",
          day: "2-digit",
        }),
      })),
    [data.daily],
  );
  const hourly = useMemo(
    () =>
      data.hourly.map((h) => ({
        ...h,
        label: `${h.hour % 12 === 0 ? 12 : h.hour % 12}${h.hour < 12 ? "a" : "p"}`,
      })),
    [data.hourly],
  );
  const peakHour = data.hourly.reduce(
    (best, h) => (h.orders > best.orders ? h : best),
    { hour: -1, orders: 0, revenue: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title="Orders"
          value={count.format(t.orders)}
          hint={`${count.format(t.unitsSold)} items sold · ${count.format(t.placedOrders)} placed`}
        />
        <Kpi
          title="Revenue"
          value={money.format(t.revenue)}
          hint={`Avg order ${money.format(t.avgOrderValue)} · discounts ${money.format(t.discount)}`}
        />
        <Kpi
          title="Customers"
          value={count.format(t.customers)}
          hint={`${count.format(t.repeatCustomers)} ordered more than once`}
        />
        <Kpi
          title="Lost orders"
          value={pct(t.lostRate)}
          hint={`${count.format(t.lostOrders)} cancelled, rejected or payment expired`}
        />
        <Kpi
          title="Added to cart"
          value={count.format(t.cartUnits)}
          hint={`${count.format(t.cartAddEvents)} add actions by ${count.format(t.cartUsers)} customers`}
        />
        <Kpi
          title="Cart → order"
          value={pct(t.cartToOrderRate)}
          hint="Customers who added to cart and then ordered"
        />
        <Kpi
          title={single ? "Restaurant rating" : "Avg restaurant rating"}
          value={
            single && data.restaurant
              ? `${data.restaurant.rating.toFixed(1)} ★`
              : t.avgRestaurantRating != null
                ? `${t.avgRestaurantRating.toFixed(1)} ★`
                : "—"
          }
          hint={
            single && data.restaurant
              ? `${count.format(data.restaurant.numReviews)} reviews overall · ${
                  t.avgRestaurantRating != null ? `${t.avgRestaurantRating.toFixed(1)} ★` : "none"
                } in range`
              : `${count.format(t.reviews)} reviews in range`
          }
        />
        <Kpi
          title="Dish ratings"
          value={count.format(t.itemRatings)}
          hint={
            t.avgDeliveryRating != null
              ? `Delivery rated ${t.avgDeliveryRating.toFixed(1)} ★`
              : "No delivery ratings in range"
          }
        />
      </div>

      <Panel title="Daily orders & revenue" subtitle={`${data.from} to ${data.to}`}>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={axisTick} interval="preserveStartEnd" />
              <YAxis yAxisId="o" tick={axisTick} allowDecimals={false} />
              <YAxis yAxisId="r" orientation="right" tick={axisTick} />
              <Tooltip content={<ChartTip />} />
              <Bar yAxisId="o" dataKey="orders" name="Orders" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="r"
                type="monotone"
                dataKey="revenue"
                name="Revenue (₹)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Most ordered items" subtitle="By quantity sold">
          <ItemTable
            rows={data.topOrderedItems}
            showRestaurant={!single}
            columns={[
              { label: "Sold", value: (r) => count.format(r.quantity) },
              { label: "Orders", value: (r) => count.format(r.orders) },
              { label: "Revenue", value: (r) => money.format(r.revenue) },
            ]}
          />
        </Panel>
        <Panel title="Most added to cart" subtitle="Units added, and how many were ordered">
          <ItemTable
            rows={data.topCartItems}
            showRestaurant={!single}
            columns={[
              { label: "Added", value: (r) => count.format(r.units) },
              { label: "Customers", value: (r) => count.format(r.users) },
              { label: "Ordered", value: (r) => `${count.format(r.orderedUnits)} (${pct(r.conversion)})` },
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Most ordered categories" subtitle="Dishes in several categories count in each">
          {data.topCategories.length === 0 ? (
            <Empty />
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={data.topCategories.slice(0, 10)}
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid
                      stroke="rgba(255,255,255,0.08)"
                      strokeDasharray="3 3"
                      horizontal={false}
                    />
                    <XAxis type="number" tick={axisTick} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={110}
                      tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 11 }}
                    />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="quantity" name="Items sold" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <SimpleTable
                head={["Category", "Sold", "Revenue", "Dishes", "Added to cart"]}
                rows={data.topCategories.map((c) => [
                  c.category,
                  count.format(c.quantity),
                  money.format(c.revenue),
                  count.format(c.dishes),
                  count.format(c.cartUnits),
                ])}
              />
            </>
          )}
        </Panel>
        <Panel
          title="Busiest hours"
          subtitle={
            peakHour.hour >= 0
              ? `Peak at ${hourly[peakHour.hour].label}m with ${peakHour.orders} orders`
              : "No orders in range"
          }
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={axisTick} interval={1} />
                <YAxis tick={axisTick} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="orders" name="Orders" fill="#98E32F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekdays} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={axisTick} />
                <YAxis tick={axisTick} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="orders" name="Orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Top rated items" subtitle={single ? "Customer dish ratings" : "At least 2 ratings"}>
          <RatedList rows={data.topRatedItems} showRestaurant={!single} />
        </Panel>
        <Panel title="Lowest rated items" subtitle="Worth a look">
          <RatedList rows={data.lowestRatedItems} showRestaurant={!single} />
        </Panel>
        <Panel title="Most reviewed items" subtitle="Ratings received in range">
          <RatedList rows={data.mostReviewedItems} showRestaurant={!single} />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Top items by revenue">
          <ItemTable
            rows={data.topRevenueItems}
            showRestaurant={!single}
            columns={[
              { label: "Revenue", value: (r) => money.format(r.revenue) },
              { label: "Sold", value: (r) => count.format(r.quantity) },
            ]}
          />
        </Panel>
        <Panel title="Added to cart but not ordered" subtitle="Biggest gap between cart adds and orders">
          <ItemTable
            rows={data.mostAbandonedItems}
            showRestaurant={!single}
            columns={[
              { label: "Added", value: (r) => count.format(r.units) },
              { label: "Ordered", value: (r) => count.format(r.orderedUnits) },
              { label: "Not ordered", value: (r) => count.format(r.units - r.orderedUnits) },
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Order outcomes" subtitle="Every order placed in range">
          {data.statusBreakdown.length === 0 ? (
            <Empty />
          ) : (
            <SimpleTable
              head={["Status", "Orders", "Share"]}
              rows={data.statusBreakdown.map((s) => [
                STATUS_LABELS[s.status] ?? s.status,
                count.format(s.count),
                data.totals.placedOrders > 0 ? pct(s.count / data.totals.placedOrders) : "—",
              ])}
            />
          )}
        </Panel>
        <Panel title="Order type">
          {data.orderTypes.length === 0 ? (
            <Empty />
          ) : (
            <SimpleTable
              head={["Type", "Orders", "Share"]}
              rows={data.orderTypes.map((o) => [
                o.type === "pickup" ? "Pickup" : "Delivery",
                count.format(o.orders),
                data.totals.orders > 0 ? pct(o.orders / data.totals.orders) : "—",
              ])}
            />
          )}
        </Panel>
      </div>

      {!single ? (
        <Panel title="Restaurant performance" subtitle="Click a restaurant to see its own metrics">
          <RestaurantTable rows={data.restaurants} onPick={onPickRestaurant} />
        </Panel>
      ) : null}
    </div>
  );
}

const axisTick = { fill: "rgba(255,255,255,0.45)", fontSize: 10 };

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-[#98E32F]/40 bg-[#98E32F]/15 text-[#98E32F]"
          : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

function ChartTip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-black/90 px-3 py-2 text-xs text-white shadow-xl">
      {label != null ? <p className="mb-1 font-semibold">{label}</p> : null}
      {payload.map((p) => (
        <p key={p.name}>
          {p.name}: {count.format(Number(p.value ?? 0))}
        </p>
      ))}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-white/5 bg-[#002833] text-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {subtitle ? <p className="text-sm text-white/50">{subtitle}</p> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Kpi({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Card className="border-white/5 bg-[#002833] text-white">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-white/60">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="mt-1 text-xs text-white/40">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return <p className="py-8 text-center text-sm text-white/40">No data in this range.</p>;
}

function ItemCell({ row, showRestaurant }: { row: InsightItemBase; showRestaurant: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium" title={row.name}>
        {row.name}
        {!row.isActive ? <span className="ml-1 text-[10px] text-white/40">(off)</span> : null}
      </p>
      <p className="truncate text-xs text-white/40">
        {[showRestaurant ? row.restaurantName : "", row.categories.join(", ")]
          .filter(Boolean)
          .join(" · ") || "—"}
      </p>
    </div>
  );
}

function ItemTable<T extends InsightItemBase>({
  rows,
  columns,
  showRestaurant,
}: {
  rows: T[];
  columns: Array<{ label: string; value: (row: T) => ReactNode }>;
  showRestaurant: boolean;
}) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="w-8 text-white/50">#</TableHead>
            <TableHead className="text-white/50">Item</TableHead>
            {columns.map((c) => (
              <TableHead key={c.label} className="text-right text-white/50">
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={`${row.menuItemId}-${i}`} className="border-white/5">
              <TableCell className="text-white/40">{i + 1}</TableCell>
              <TableCell className="max-w-64">
                <ItemCell row={row} showRestaurant={showRestaurant} />
              </TableCell>
              {columns.map((c) => (
                <TableCell key={c.label} className="whitespace-nowrap text-right text-sm">
                  {c.value(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RatedList({
  rows,
  showRestaurant,
}: {
  rows: Array<InsightItemBase & { rating: number; ratingCount: number }>;
  showRestaurant: boolean;
}) {
  if (rows.length === 0) return <Empty />;
  return (
    <ul className="space-y-3">
      {rows.map((row, i) => (
        <li key={`${row.menuItemId}-${i}`} className="flex items-center justify-between gap-3">
          <ItemCell row={row} showRestaurant={showRestaurant} />
          <div className="shrink-0 text-right">
            <p className="flex items-center justify-end gap-1 text-sm font-semibold text-[#98E32F]">
              <Star className="h-3.5 w-3.5 fill-current" />
              {row.rating.toFixed(1)}
            </p>
            <p className="text-[11px] text-white/40">{row.ratingCount} ratings</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            {head.map((h, i) => (
              <TableHead key={h} className={`text-white/50 ${i > 0 ? "text-right" : ""}`}>
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((cells, r) => (
            <TableRow key={r} className="border-white/5">
              {cells.map((cell, i) => (
                <TableCell key={i} className={i > 0 ? "text-right text-sm" : "text-sm"}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RestaurantTable({
  rows,
  onPick,
}: {
  rows: InsightRestaurant[];
  onPick: (id: string) => void;
}) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/50">Restaurant</TableHead>
            <TableHead className="text-right text-white/50">Orders</TableHead>
            <TableHead className="text-right text-white/50">Revenue</TableHead>
            <TableHead className="text-right text-white/50">Avg order</TableHead>
            <TableHead className="text-right text-white/50">Customers</TableHead>
            <TableHead className="text-right text-white/50">Lost</TableHead>
            <TableHead className="text-right text-white/50">Rating</TableHead>
            <TableHead className="text-white/50">Best seller</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.restaurantId}
              className="cursor-pointer border-white/5 hover:bg-white/5"
              onClick={() => onPick(r.restaurantId)}
            >
              <TableCell>
                <p className="font-medium">{r.name}</p>
                <p className={`text-xs ${r.isOpen ? "text-emerald-400" : "text-white/40"}`}>
                  {r.isOpen ? "Open" : "Closed"}
                </p>
              </TableCell>
              <TableCell className="text-right text-sm">
                {count.format(r.completed)}
                <span className="block text-[11px] text-white/40">{r.placed} placed</span>
              </TableCell>
              <TableCell className="text-right text-sm">{money.format(r.revenue)}</TableCell>
              <TableCell className="text-right text-sm">{money.format(r.avgOrderValue)}</TableCell>
              <TableCell className="text-right text-sm">{count.format(r.customers)}</TableCell>
              <TableCell className={`text-right text-sm ${r.lostRate > 0.2 ? "text-red-300" : ""}`}>
                {pct(r.lostRate)}
              </TableCell>
              <TableCell className="text-right text-sm">
                {r.rating > 0 ? `${r.rating.toFixed(1)} ★` : "—"}
                <span className="block text-[11px] text-white/40">
                  {r.periodRating != null
                    ? `${r.periodRating.toFixed(1)} in range (${r.periodReviews})`
                    : `${r.numReviews} reviews`}
                </span>
              </TableCell>
              <TableCell className="max-w-48 truncate text-sm">
                {r.topItem ? `${r.topItem.name} (${r.topItem.quantity})` : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
