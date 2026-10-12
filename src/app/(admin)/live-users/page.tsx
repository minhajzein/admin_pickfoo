"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Loader2, MapPin, RefreshCw, Smartphone, Users } from "lucide-react";
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
import { fetchLiveUsers, type LiveAppUser } from "@/lib/api/analytics";
import { useMapboxAccessToken } from "@/lib/mapbox-token-context";
import { visibleRefetchInterval } from "@/lib/query-live";

const LiveUsersMap = dynamic(() => import("@/components/map/LiveUsersMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(64vh,680px)] min-h-96 items-center justify-center rounded-xl border border-white/10 bg-black/20">
      <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
    </div>
  ),
});

const WINDOWS = [
  { minutes: 3, label: "Now (3 min)" },
  { minutes: 15, label: "15 min" },
  { minutes: 60, label: "1 hour" },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export default function LiveUsersPage() {
  const token = useMapboxAccessToken();
  const [windowMinutes, setWindowMinutes] = useState(3);
  const [showGuests, setShowGuests] = useState(true);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["live-users", windowMinutes],
    queryFn: () => fetchLiveUsers(windowMinutes),
    refetchInterval: visibleRefetchInterval(30_000),
  });

  const users = useMemo(
    () => (data?.users ?? []).filter((u) => showGuests || !u.isGuest),
    [data?.users, showGuests],
  );
  const s = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live users</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Customers with the Pickfoo app open right now, and where they are in the app
            (device GPS when location is allowed, otherwise their delivery or browse location).
            Refreshes every 30 seconds.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {WINDOWS.map((w) => (
            <Chip
              key={w.minutes}
              active={windowMinutes === w.minutes}
              onClick={() => setWindowMinutes(w.minutes)}
              label={w.label}
            />
          ))}
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
        <Stat
          title="Online now"
          value={s?.online ?? 0}
          hint={`${s?.loggedIn ?? 0} signed in · ${s?.guests ?? 0} guests`}
          icon={<Activity className="h-4 w-4 text-[#98E32F]" />}
          loading={isLoading}
        />
        <Stat
          title="On the map"
          value={s?.withLocation ?? 0}
          hint={`${s?.withDeviceLocation ?? 0} with device GPS`}
          icon={<MapPin className="h-4 w-4 text-sky-300" />}
          loading={isLoading}
        />
        <Stat
          title="Active today"
          value={s?.activeToday ?? 0}
          hint={`${s?.activeLast7Days ?? 0} in the last 7 days · ${s?.installs ?? 0} installs`}
          icon={<Users className="h-4 w-4 text-purple-300" />}
          loading={isLoading}
        />
        <Stat
          title="Platform"
          value={`${s?.android ?? 0} / ${s?.ios ?? 0}`}
          hint="Android / iOS online now"
          icon={<Smartphone className="h-4 w-4 text-amber-300" />}
          loading={isLoading}
        />
      </div>

      <Card className="border-white/10 bg-[#002833]/70 text-white">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-base">Where users are</CardTitle>
          <Chip
            active={showGuests}
            onClick={() => setShowGuests((v) => !v)}
            label="Include guests"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              Set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to render the map.
            </div>
          ) : (
            <LiveUsersMap accessToken={token} users={users} />
          )}
          <div className="flex flex-wrap gap-4 text-xs text-white/60">
            <Legend color="#98E32F" label="Signed-in customer" />
            <Legend color="#94a3b8" label="Guest" />
            <Legend color="#0ea5e9" label="Blue ring = device GPS" ring />
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#002833]/70 text-white">
        <CardHeader>
          <CardTitle className="text-base">Users in the app ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <p className="py-8 text-center text-sm text-red-300">
              Could not load live users. Check admin-api `/analytics/live-users`.
            </p>
          ) : isLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#98E32F]" />
            </div>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/40">
              Nobody has the app open in this window.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/50">Customer</TableHead>
                    <TableHead className="text-white/50">Location</TableHead>
                    <TableHead className="text-white/50">App</TableHead>
                    <TableHead className="text-white/50">In app for</TableHead>
                    <TableHead className="text-white/50">Last seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <UserRow key={u.id} user={u} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({ user }: { user: LiveAppUser }) {
  return (
    <TableRow className="border-white/5">
      <TableCell>
        <p className="font-medium">{user.name}</p>
        <p className="text-xs text-white/40">{user.isGuest ? "Not signed in" : user.phone}</p>
      </TableCell>
      <TableCell>
        {user.lat != null && user.lng != null ? (
          <>
            <p className="text-sm">{user.locationLabel || "Pinned location"}</p>
            <p className="text-xs text-white/40">
              {user.locationSource === "device" ? "Device GPS" : "Delivery / browse"} ·{" "}
              {user.lat.toFixed(4)}, {user.lng.toFixed(4)}
            </p>
          </>
        ) : (
          <span className="text-xs text-white/40">No location yet</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-white/70">
        {user.platform || "—"}
        {user.appVersion ? ` · v${user.appVersion}` : ""}
      </TableCell>
      <TableCell className="text-sm text-white/70">{timeAgo(user.sessionStartedAt)}</TableCell>
      <TableCell className="text-sm text-white/70">{timeAgo(user.lastSeenAt)}</TableCell>
    </TableRow>
  );
}

function Stat({
  title,
  value,
  hint,
  icon,
  loading,
}: {
  title: string;
  value: number | string;
  hint: string;
  icon: ReactNode;
  loading?: boolean;
}) {
  return (
    <Card className="border-white/10 bg-[#002833]/70 text-white">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm text-white/60">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">
          {loading ? <Loader2 className="h-6 w-6 animate-spin text-[#98E32F]" /> : value}
        </div>
        <p className="mt-1 text-xs text-white/50">{hint}</p>
      </CardContent>
    </Card>
  );
}

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

function Legend({ color, label, ring }: { color: string; label: string; ring?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-3 w-3 rounded-full"
        style={ring ? { border: `2px solid ${color}` } : { backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  );
}
