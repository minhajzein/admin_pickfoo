"use client";

import NextImage from "next/image";
import { MapPin, Star, BadgeCheck, Crown } from "lucide-react";

type RestaurantHeroData = {
  name: string;
  description?: string;
  image?: string;
  brandLogo?: string;
  rating?: number;
  numReviews?: number;
  status?: string;
  restaurantTypes?: string[];
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
};

function capitalizeName(name: string) {
  return name
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function formatRatingsCount(n: number) {
  if (!n || n <= 0) return "New on Pickfoo";
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K+ ratings`;
  return `${n} rating${n === 1 ? "" : "s"}`;
}

function typeLabel(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Customer-app style restaurant profile hero (Flutter RestaurantDetailScreen). */
export function RestaurantProfileHero({
  restaurant,
  categoryHint,
}: {
  restaurant: RestaurantHeroData;
  categoryHint?: string;
}) {
  const cover = restaurant.image?.trim();
  const logo = restaurant.brandLogo?.trim();
  const imageUrl = cover || logo || "";
  const rating =
    typeof restaurant.rating === "number" && restaurant.rating > 0
      ? restaurant.rating.toFixed(1)
      : "—";
  const bestLine =
    categoryHint && categoryHint.trim()
      ? `Best in ${categoryHint}`
      : "Customer favourite";
  const types = (restaurant.restaurantTypes ?? []).filter(
    (t) => !(restaurant.restaurantTypes?.length === 1 && t === "restaurant"),
  );

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-lg min-h-[220px]">
      {imageUrl ? (
        <NextImage
          src={imageUrl}
          alt={restaurant.name}
          fill
          unoptimized
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-[#013644]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/75" />

      <div className="relative z-10 p-5 sm:p-6 space-y-3 text-white">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold">
            <Crown size={16} className="text-amber-300" />
            {bestLine}
          </span>
          {restaurant.status === "active" && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-200">
              <BadgeCheck size={14} />
              Pickfoo verified
            </span>
          )}
        </div>

        {types.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {types.map((t) => (
              <span
                key={t}
                className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/15 border border-white/25"
              >
                {typeLabel(t)}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl sm:text-[28px] font-black leading-tight drop-shadow-md">
            {capitalizeName(restaurant.name)}
          </h1>
          <div className="shrink-0 text-right">
            <div className="inline-flex items-center gap-1 rounded-lg bg-[#98E32F] text-[#013644] px-2 py-1 font-black text-sm">
              {rating}
              <Star size={14} fill="currentColor" />
            </div>
            <p className="text-[11px] text-white/80 mt-1">
              {formatRatingsCount(restaurant.numReviews ?? 0)}
            </p>
          </div>
        </div>

        {restaurant.address && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white/90">
            <MapPin size={16} className="shrink-0 opacity-80" />
            <span className="truncate">
              {[restaurant.address.street, restaurant.address.city]
                .filter(Boolean)
                .join(", ")}
            </span>
          </p>
        )}

        {restaurant.description ? (
          <p className="text-sm text-white/75 line-clamp-2 max-w-3xl">
            {restaurant.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
