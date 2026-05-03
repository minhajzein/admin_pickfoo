"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { clearMonitorEvents, fetchMonitorEvents } from "@/lib/api/monitor";
import type { AdminMonitorEvent } from "@/types/models";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";

const DEFAULT_LIMIT = 150;

export default function MonitorPage() {
  const queryClient = useQueryClient();
  const [eventFilter, setEventFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [liveEvents, setLiveEvents] = useState<AdminMonitorEvent[]>([]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["monitor-events", eventFilter, sourceFilter, limit],
    queryFn: () =>
      fetchMonitorEvents({
        event: eventFilter.trim() || undefined,
        source: sourceFilter.trim() || undefined,
        limit,
      }),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const onMonitorEvent = (evt: Event) => {
      const detail = (evt as CustomEvent).detail;
      const normalized = normalizeMonitorEvent(detail);
      if (!normalized) return;
      setLiveEvents((prev) => {
        const next = [normalized, ...prev.filter((e) => e.id !== normalized.id)];
        return next.slice(0, Math.max(50, limit));
      });
    };

    window.addEventListener("admin:monitor-event", onMonitorEvent as EventListener);
    return () => {
      window.removeEventListener("admin:monitor-event", onMonitorEvent as EventListener);
    };
  }, [limit]);

  const events = useMemo(() => {
    const merged = new Map<string, AdminMonitorEvent>();
    for (const item of liveEvents) merged.set(item.id, item);
    for (const item of data ?? []) {
      if (!merged.has(item.id)) merged.set(item.id, item);
    }
    return Array.from(merged.values())
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, Math.max(50, limit));
  }, [data, liveEvents, limit]);

  const clearMutation = useMutation({
    mutationFn: clearMonitorEvents,
    onSuccess: (deleted) => {
      setLiveEvents([]);
      queryClient.invalidateQueries({ queryKey: ["monitor-events"] });
      toast.success(`Cleared ${deleted} monitor events`);
    },
    onError: () => toast.error("Failed to clear monitor events"),
  });

  const sources = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (e.source) set.add(e.source);
    });
    return Array.from(set).sort();
  }, [events]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Live Monitor</h2>
          <p className="text-sm text-white/50">
            Realtime event stream across customer, restaurant, delivery, and admin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-white/10 text-white hover:bg-white/5"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["monitor-events"] })
            }
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button
            variant="outline"
            className="border-red-400/40 text-red-300 hover:bg-red-500/10"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            {clearMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Clear
          </Button>
        </div>
      </div>

      <Card className="border-white/5 bg-[#002833] text-white">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="event (e.g. dispatch:partner-assigned)"
            className="border-white/10 bg-[#013644] text-white"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
          />
          <Input
            placeholder="source (e.g. restaurant-api)"
            className="border-white/10 bg-[#013644] text-white"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          />
          <Input
            type="number"
            min={20}
            max={500}
            className="border-white/10 bg-[#013644] text-white"
            value={limit}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isNaN(n)) return;
              setLimit(Math.max(20, Math.min(500, n)));
            }}
          />
          <div className="flex items-center gap-2 overflow-auto">
            {sources.length === 0 ? (
              <span className="text-xs text-white/40">No source tags yet</span>
            ) : (
              sources.slice(0, 8).map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="cursor-pointer border-white/20 text-white/80"
                  onClick={() => setSourceFilter(s)}
                >
                  {s}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/5 bg-[#002833] text-white">
        <CardHeader>
          <CardTitle className="text-base">
            Event Stream ({events.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="py-10 text-center text-white/60">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[#98E32F]" />
              Loading monitor events...
            </div>
          ) : events.length === 0 ? (
            <div className="py-10 text-center text-white/40">
              No events found for this filter.
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="rounded-lg border border-white/10 bg-[#013644] p-3"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className="bg-[#98E32F] text-[#013644]">
                    {event.event}
                  </Badge>
                  {event.source ? (
                    <Badge variant="outline" className="border-white/20 text-white/80">
                      {event.source}
                    </Badge>
                  ) : null}
                  <span className="ml-auto text-xs text-white/40">
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                </div>
                <pre className="max-h-64 overflow-auto rounded bg-black/20 p-2 text-xs text-white/80">
{JSON.stringify(event.payload ?? {}, null, 2)}
                </pre>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function normalizeMonitorEvent(value: unknown): AdminMonitorEvent | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const event = typeof obj.event === "string" ? obj.event : "";
  const createdAt = typeof obj.createdAt === "string" ? obj.createdAt : "";
  if (!event || !createdAt) return null;
  return {
    id:
      typeof obj.id === "string" && obj.id
        ? obj.id
        : `${createdAt}-${event}-${Math.random().toString(36).slice(2, 8)}`,
    event,
    source: typeof obj.source === "string" ? obj.source : undefined,
    payload: obj.payload,
    createdAt,
  };
}
