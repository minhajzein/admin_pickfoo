"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateRestaurantAvailability } from "@/lib/api/restaurants";
import type { OpeningHour } from "@/types/models";

type ScheduleRestaurant = {
  _id?: string;
  status: string;
  isOpen?: boolean;
  isManualOverride?: boolean;
  openStatusPriority?: "schedule" | "manual";
  manualOverrideUntil?: string | null;
  openingHours?: OpeningHour[] | null;
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function defaultHours(): OpeningHour[] {
  return DAY_NAMES.map((_, day) => ({
    day,
    openTime: "09:00",
    closeTime: "22:00",
    isClosed: false,
  }));
}

function normalizeHours(raw?: OpeningHour[] | null): OpeningHour[] {
  const byDay = new Map<number, OpeningHour>();
  for (const entry of raw ?? []) {
    if (entry && entry.day >= 0 && entry.day <= 6) {
      byDay.set(entry.day, {
        day: entry.day,
        openTime: (entry.openTime || "09:00").slice(0, 5),
        closeTime: (entry.closeTime || "22:00").slice(0, 5),
        isClosed: Boolean(entry.isClosed),
      });
    }
  }
  return defaultHours().map((fallback) => byDay.get(fallback.day) ?? fallback);
}

function formatOverrideUntil(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RestaurantScheduleEditor({
  restaurantId,
  restaurant,
}: {
  restaurantId: string;
  restaurant: ScheduleRestaurant;
}) {
  const queryClient = useQueryClient();
  const [hours, setHours] = useState<OpeningHour[]>(() =>
    normalizeHours(restaurant.openingHours),
  );
  const [priority, setPriority] = useState<"schedule" | "manual">(
    restaurant.openStatusPriority === "manual" ? "manual" : "schedule",
  );

  useEffect(() => {
    setHours(normalizeHours(restaurant.openingHours));
    setPriority(
      restaurant.openStatusPriority === "manual" ? "manual" : "schedule",
    );
  }, [restaurant._id, restaurant.openingHours, restaurant.openStatusPriority]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#schedule") return;
    document
      .getElementById("schedule")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const overrideUntil = useMemo(
    () => formatOverrideUntil(restaurant.manualOverrideUntil),
    [restaurant.manualOverrideUntil],
  );

  const mutation = useMutation({
    mutationFn: (
      payload: Parameters<typeof updateRestaurantAvailability>[1],
    ) => updateRestaurantAvailability(restaurantId, payload),
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      if ("resetOverride" in payload && "openingHours" in payload) {
        toast.success("Schedule saved and applied");
      } else if ("openingHours" in payload) {
        toast.success("Schedule hours saved");
      } else if ("resetOverride" in payload) {
        toast.success("Returned to schedule");
      } else if ("openStatusPriority" in payload) {
        toast.success(
          payload.openStatusPriority === "schedule"
            ? "Schedule has priority"
            : "Manual open/close has priority",
        );
      } else if ("isOpen" in payload) {
        toast.success(
          payload.isOpen ? "Restaurant marked open" : "Restaurant marked closed",
        );
      }
    },
    onError: () => toast.error("Failed to update schedule"),
  });

  const busy = mutation.isPending;
  const isOpen = Boolean(restaurant.isOpen);
  const isOverride = Boolean(restaurant.isManualOverride);

  const patchHour = (day: number, patch: Partial<OpeningHour>) => {
    setHours((prev) =>
      prev.map((row) => (row.day === day ? { ...row, ...patch } : row)),
    );
  };

  return (
    <Card id="schedule" className="scroll-mt-24 border-white/5 bg-[#002833] text-white">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock size={20} className="text-[#98E32F]" />
          Open / close schedule
        </CardTitle>
        <CardDescription className="text-white/40">
          Weekly hours in IST. Choose whether the schedule or the Open/Closed
          switch has priority.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-bold",
              isOpen
                ? "bg-[#98E32F]/20 text-[#98E32F]"
                : "bg-red-500/20 text-red-400",
            )}
          >
            Shop {isOpen ? "OPEN" : "CLOSED"}
          </span>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
            {priority === "schedule"
              ? "Priority · schedule"
              : "Priority · manual"}
          </span>
          {isOverride ? (
            <span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-[11px] text-orange-300">
              {priority === "schedule"
                ? overrideUntil
                  ? `Temp override until ${overrideUntil}`
                  : "Temporary override"
                : "Manual override"}
            </span>
          ) : (
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/40">
              Following schedule
            </span>
          )}
        </div>

        {restaurant.status === "active" ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/20 p-0.5">
              <button
                type="button"
                disabled={busy || isOpen}
                onClick={() => mutation.mutate({ isOpen: true })}
                className={cn(
                  "rounded px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50",
                  isOpen
                    ? "bg-[#98E32F] text-[#013644]"
                    : "text-white/60 hover:bg-white/5 hover:text-white",
                )}
              >
                Open now
              </button>
              <button
                type="button"
                disabled={busy || !isOpen}
                onClick={() => mutation.mutate({ isOpen: false })}
                className={cn(
                  "rounded px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50",
                  !isOpen
                    ? "bg-red-500/90 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white",
                )}
              >
                Close now
              </button>
            </div>
            {isOverride ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => mutation.mutate({ resetOverride: true })}
                className="border-[#98E32F]/40 text-[#98E32F] hover:bg-[#98E32F]/10"
              >
                Resume schedule
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-white/40">
            Shop open/close is available after the restaurant is approved.
          </p>
        )}

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
            What should control open / close?
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setPriority("schedule")}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors disabled:opacity-60",
                priority === "schedule"
                  ? "border-[#98E32F] bg-[#98E32F]/10"
                  : "border-white/10 bg-black/20 hover:border-white/25",
              )}
            >
              <p
                className={cn(
                  "text-sm font-bold",
                  priority === "schedule" ? "text-[#98E32F]" : "text-white",
                )}
              >
                Follow schedule
              </p>
              <p className="mt-1 text-[11px] leading-snug text-white/55">
                Hours win at the next open or close. A manual toggle is
                temporary.
              </p>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPriority("manual")}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors disabled:opacity-60",
                priority === "manual"
                  ? "border-[#98E32F] bg-[#98E32F]/10"
                  : "border-white/10 bg-black/20 hover:border-white/25",
              )}
            >
              <p
                className={cn(
                  "text-sm font-bold",
                  priority === "manual" ? "text-[#98E32F]" : "text-white",
                )}
              >
                Manual switch
              </p>
              <p className="mt-1 text-[11px] leading-snug text-white/55">
                Open/Closed stays until you tap Resume schedule.
              </p>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Weekly hours
          </p>
          <div className="overflow-hidden rounded-xl border border-white/10">
            {hours.map((row) => (
              <div
                key={row.day}
                className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2.5 last:border-b-0 sm:flex-nowrap"
              >
                <p className="w-24 shrink-0 text-sm font-semibold text-white">
                  {DAY_NAMES[row.day]}
                </p>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    type="time"
                    value={row.openTime}
                    disabled={busy || row.isClosed}
                    onChange={(e) =>
                      patchHour(row.day, {
                        openTime: e.target.value.slice(0, 5),
                      })
                    }
                    className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white [color-scheme:dark] focus:border-[#98E32F]/50 focus:outline-none disabled:opacity-40"
                  />
                  <span className="text-xs text-white/40">to</span>
                  <input
                    type="time"
                    value={row.closeTime}
                    disabled={busy || row.isClosed}
                    onChange={(e) =>
                      patchHour(row.day, {
                        closeTime: e.target.value.slice(0, 5),
                      })
                    }
                    className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white [color-scheme:dark] focus:border-[#98E32F]/50 focus:outline-none disabled:opacity-40"
                  />
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    patchHour(row.day, { isClosed: !row.isClosed })
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide disabled:opacity-50",
                    row.isClosed
                      ? "border-red-500/60 bg-red-500/15 text-red-400"
                      : "border-[#98E32F]/60 bg-[#98E32F]/15 text-[#98E32F]",
                  )}
                >
                  {row.isClosed ? "CLOSED" : "OPEN"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <Button
          type="button"
          disabled={busy}
          className="w-full bg-[#98E32F] font-bold text-[#013644] hover:bg-[#86c926]"
          onClick={() =>
            mutation.mutate({
              openingHours: hours,
              openStatusPriority: priority,
              ...(priority === "schedule" ? { resetOverride: true } : {}),
            })
          }
        >
          {busy ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save schedule
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
