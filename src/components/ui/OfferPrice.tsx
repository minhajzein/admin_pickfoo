"use client";

import { cn } from "@/lib/utils";

type OfferPriceProps = {
  /** Catalog / menu list price. */
  price: number;
  /** Post-offer unit or total when lower than [price]. */
  offerPrice?: number | null;
  className?: string;
  /** `light` for mint cards; `dark` for teal admin surfaces. */
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  prefix?: string;
  /**
   * Which amount reads as primary.
   * - `list`: struck catalog then green offer (menu cards / customer-style)
   * - `offer`: green offer first, struck catalog secondary (orders / ledgers)
   */
  primary?: "list" | "offer";
};

function fmt(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value - Math.round(value)) < 0.009) return String(Math.round(value));
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function hasOfferPrice(price: number, offerPrice?: number | null) {
  return (
    offerPrice != null &&
    Number.isFinite(offerPrice) &&
    offerPrice >= 0 &&
    offerPrice < price - 0.009
  );
}

/**
 * Dual price display: catalog vs offer.
 * Orders/ledgers should use primary="offer" so the charged/offer amount leads.
 */
export function OfferPrice({
  price,
  offerPrice,
  className,
  tone = "dark",
  size = "md",
  prefix = "₹",
  primary = "list",
}: OfferPriceProps) {
  const sizeClass =
    size === "sm" ? "text-xs" : size === "lg" ? "text-[15px]" : "text-sm";
  const offerSizeClass =
    size === "sm" ? "text-xs" : size === "lg" ? "text-[15px]" : "text-sm";
  const struckSizeClass =
    size === "sm" ? "text-[10px]" : size === "lg" ? "text-xs" : "text-[11px]";

  if (!hasOfferPrice(price, offerPrice)) {
    return (
      <span
        className={cn(
          "font-black tabular-nums",
          sizeClass,
          tone === "light" ? "text-black" : "text-white",
          className,
        )}
      >
        {prefix}
        {fmt(price)}
      </span>
    );
  }

  const struck = (
    <span
      className={cn(
        "font-semibold line-through decoration-2",
        struckSizeClass,
        tone === "light" ? "text-black/45" : "text-white/40",
      )}
    >
      {prefix}
      {fmt(price)}
    </span>
  );
  const deal = (
    <span className={cn("font-black text-[#98E32F]", offerSizeClass)}>
      {prefix}
      {fmt(offerPrice!)}
    </span>
  );

  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 tabular-nums",
        className,
      )}
    >
      {primary === "offer" ? (
        <>
          {deal}
          {struck}
        </>
      ) : (
        <>
          {struck}
          {deal}
        </>
      )}
    </span>
  );
}

/** Post-discount food total for orders/ledgers. */
export function offerFoodTotal(
  itemTotal?: number | null,
  discountAmount?: number | null,
): number {
  const food = Math.max(0, Number(itemTotal) || 0);
  const discount = Math.max(0, Number(discountAmount) || 0);
  return Math.round(Math.max(0, food - Math.min(discount, food)) * 100) / 100;
}
