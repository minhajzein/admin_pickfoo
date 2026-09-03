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

function formatSettleDay(iso: string): string {
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
  className,
}: {
  batches: PendingSettlementBatch[];
  restaurantName?: string | null;
  emptyLabel?: string;
  className?: string;
}) {
  if (batches.length === 0) {
    return (
      <p className={cn("text-xs text-white/40", className)}>{emptyLabel}</p>
    );
  }

  const name = restaurantName?.trim();

  return (
    <div className={cn("space-y-2", className)}>
      {batches.map((batch, index) => (
        <div
          key={`${batch.settleAt}-${index}`}
          className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2"
        >
          <Clock size={14} className="shrink-0 text-amber-300" />
          <p className="flex-1 text-xs text-white/70">
            {name ? `${name} · ` : ""}
            Settles on {formatSettleDay(batch.settleAt)}
          </p>
          <p className="text-sm font-semibold tabular-nums text-amber-200">
            {money.format(batch.amount)}
          </p>
        </div>
      ))}
    </div>
  );
}
