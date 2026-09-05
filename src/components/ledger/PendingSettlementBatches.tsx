"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type PendingSettlementBatch = {
  amount: number;
  settleAt: string;
};

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatSettleDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return iso;
  }
}

export function PendingSettlementBatches({
  batches,
  restaurantName,
  emptyLabel = "No pending Razorpay settlements",
  layout = "stack",
  className,
}: {
  batches: PendingSettlementBatch[];
  restaurantName?: string | null;
  emptyLabel?: string;
  layout?: "stack" | "row";
  className?: string;
}) {
  if (batches.length === 0) {
    return (
      <p className={cn("text-xs text-white/40", className)}>{emptyLabel}</p>
    );
  }

  const name = restaurantName?.trim();
  const row = layout === "row";

  return (
    <div
      className={cn(
        row
          ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
          : "space-y-2",
        className,
      )}
    >
      {batches.map((batch, index) => (
        <div
          key={`${batch.settleAt}-${index}`}
          className="flex min-w-0 items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-1.5"
        >
          <Clock size={14} className="shrink-0 text-amber-300" />
          <p className="min-w-0 flex-1 truncate text-xs text-white/70">
            {name ? `${name} · ` : ""}
            {formatSettleDay(batch.settleAt)}
          </p>
          <p className="shrink-0 text-sm font-semibold tabular-nums text-amber-200">
            {money.format(batch.amount)}
          </p>
        </div>
      ))}
    </div>
  );
}
