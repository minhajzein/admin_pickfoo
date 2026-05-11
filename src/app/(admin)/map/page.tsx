"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bike, Loader2, MapPinned, RefreshCw, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchLiveMapFeed } from "@/lib/api/map";

const LiveOperationsMap = dynamic(
  () => import("@/components/map/LiveOperationsMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(72vh,760px)] min-h-[420px] items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/50">
        <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
      </div>
    ),
  },
);

export default function LiveMapPage() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
  const queryClient = useQueryClient();
  const [showPartners, setShowPartners] = useState(true);
  const [showRestaurants, setShowRestaurants] = useState(true);
  const [onlineOnly, setOnlineOnly] = useState(true);
  const [activeRestaurantsOnly, setActiveRestaurantsOnly] = useState(true);

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["live-map", onlineOnly, activeRestaurantsOnly],
    queryFn: () =>
      fetchLiveMapFeed({
        onlineOnly,
        activeRestaurantsOnly,
      }),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["live-map"] });
    };
    window.addEventListener("admin:dispatch-updated", refresh);
    return () => window.removeEventListener("admin:dispatch-updated", refresh);
  }, [queryClient]);

  const summary = data?.summary;
  const refreshedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live map</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Active restaurants and delivery partners with saved map coordinates.
            Markers refresh every 30 seconds and after dispatch updates.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Partners on map"
          value={summary?.partnersMapped ?? 0}
          hint={`${summary?.partnersOnline ?? 0} online · ${summary?.partnersOnDuty ?? 0} on delivery`}
          icon={<Bike className="h-4 w-4 text-[#98E32F]" />}
        />
        <SummaryCard
          title="Restaurants on map"
          value={summary?.restaurantsMapped ?? 0}
          hint={
            summary?.restaurantsMissingLocation
              ? `${summary.restaurantsMissingLocation} active without coordinates`
              : "Active restaurants with coordinates"
          }
          icon={<Store className="h-4 w-4 text-amber-400" />}
        />
        <SummaryCard
          title="Partners missing GPS"
          value={summary?.partnersMissingLocation ?? 0}
          hint="Online partners without a saved location"
          icon={<MapPinned className="h-4 w-4 text-sky-300" />}
        />
        <SummaryCard
          title="Last refresh"
          value={refreshedLabel}
          hint={data?.refreshedAt ? new Date(data.refreshedAt).toLocaleString() : "Waiting for data"}
          icon={<RefreshCw className="h-4 w-4 text-white/70" />}
          valueIsText
        />
      </div>

      <Card className="border-white/10 bg-[#002833]/70">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-base text-white">Map layers</CardTitle>
          <div className="flex flex-wrap gap-2">
            <ToggleChip
              active={showPartners}
              onClick={() => setShowPartners((value) => !value)}
              label="Partners"
            />
            <ToggleChip
              active={showRestaurants}
              onClick={() => setShowRestaurants((value) => !value)}
              label="Restaurants"
            />
            <ToggleChip
              active={onlineOnly}
              onClick={() => setOnlineOnly((value) => !value)}
              label="Online partners only"
            />
            <ToggleChip
              active={activeRestaurantsOnly}
              onClick={() => setActiveRestaurantsOnly((value) => !value)}
              label="Active restaurants only"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              Set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to render the live map.
            </div>
          ) : isLoading ? (
            <div className="flex h-[min(72vh,760px)] min-h-[420px] items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/50">
              <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
            </div>
          ) : (
            <LiveOperationsMap
              accessToken={token}
              partners={data?.partners ?? []}
              restaurants={data?.restaurants ?? []}
              showPartners={showPartners}
              showRestaurants={showRestaurants}
            />
          )}

          <div className="flex flex-wrap gap-4 text-xs text-white/60">
            <LegendSwatch color="#f59e0b" label="Restaurant" />
            <LegendSwatch color="#98E32F" label="Partner online" />
            <LegendSwatch color="#38bdf8" label="Partner on delivery" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  hint,
  icon,
  valueIsText = false,
}: {
  title: string;
  value: number | string;
  hint: string;
  icon: ReactNode;
  valueIsText?: boolean;
}) {
  return (
    <Card className="border-white/10 bg-[#002833]/70">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm text-white/60">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={valueIsText ? "text-lg font-semibold text-white" : "text-3xl font-bold text-white"}>
          {value}
        </div>
        <p className="mt-1 text-xs text-white/50">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ToggleChip({
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

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}
