"use client";

import NextImage from "next/image";
import { Clock, Edit2, ImageIcon, Loader2, Star, Trash2 } from "lucide-react";
import type { AdminMenuItem } from "@/lib/api/menu";

function displayPrice(item: AdminMenuItem) {
  if (item.variants && item.variants.length > 0) {
    return Math.min(...item.variants.map((v) => v.price));
  }
  return item.price;
}

function ratingLabel(item: AdminMenuItem) {
  const rating = typeof item.rating === "number" ? item.rating : 0;
  const reviews = typeof item.numReviews === "number" ? item.numReviews : 0;
  if (rating <= 0 && reviews <= 0) return null;
  if (reviews > 0) return `${rating.toFixed(1)} (${reviews})`;
  return rating.toFixed(1);
}

/** Mint menu card matching customer Flutter MenuItemCard. */
export function CustomerStyleMenuCard({
  item,
  restaurantName,
  onEdit,
  onDelete,
  onToggleActive,
  isTogglingActive = false,
}: {
  item: AdminMenuItem;
  restaurantName?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleActive?: (next: boolean) => void;
  isTogglingActive?: boolean;
}) {
  const prep = item.preparationTime ?? 0;
  const rating = ratingLabel(item);
  const grayscale = !item.isActive;

  return (
    <div className="group flex flex-col rounded-[20px] bg-[#F5FFE5] overflow-hidden shadow-sm border border-black/5">
      <div className="relative aspect-[4/5] min-h-[140px]">
        <div
          className={`absolute inset-0 overflow-hidden rounded-tr-[20px] rounded-tl-[20px] rounded-br-[20px] ${
            grayscale ? "grayscale" : ""
          }`}
        >
          {item.image ? (
            <NextImage
              src={item.image}
              alt={item.name}
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-neutral-200 flex items-center justify-center text-neutral-400">
              <ImageIcon size={28} />
            </div>
          )}
        </div>

        {prep > 0 && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[8px] font-extrabold text-white">
            <Clock size={9} />
            {prep} min
          </div>
        )}

        <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-[#98E32F] hover:text-[#013644]"
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-red-500"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {!item.isActive && (
          <div className="absolute inset-0 z-[5] bg-black/45 flex items-center justify-center rounded-tr-[20px] rounded-tl-[20px] rounded-br-[20px]">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white px-2 py-1 rounded">
              Inactive
            </span>
          </div>
        )}

        {(rating || item.isVeg !== undefined) && (
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-2.5 py-2 rounded-br-[20px]">
            <div className="flex items-center justify-between gap-2">
              {rating ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-white">
                  <Star size={10} className="text-[#FFD700]" fill="#FFD700" />
                  {rating}
                </span>
              ) : (
                <span />
              )}
              <span
                className={`w-2.5 h-2.5 rounded-sm border flex items-center justify-center p-px ${
                  item.isVeg ? "border-green-400" : "border-red-400"
                }`}
                title={item.isVeg ? "Veg" : "Non-veg"}
              >
                <span
                  className={`w-full h-full rounded-full ${
                    item.isVeg ? "bg-green-500" : "bg-red-500"
                  }`}
                />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="px-2.5 pt-2 pb-3 flex flex-col gap-1">
        <p className="text-[13px] font-extrabold text-neutral-700 truncate">
          {item.name}
        </p>
        {restaurantName ? (
          <p className="text-[10px] font-bold text-[#1B5E20] truncate">
            {restaurantName}
          </p>
        ) : (
          <p className="text-[10px] font-semibold text-neutral-500 truncate">
            {item.category}
            {item.type ? ` · ${item.type}` : ""}
          </p>
        )}
        <div className="flex items-end justify-between gap-2 mt-0.5">
          <p className="text-[15px] font-black text-black">
            ₹{Math.round(displayPrice(item))}
          </p>
          <div className="flex gap-1 sm:hidden">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="p-1 text-neutral-600"
              >
                <Edit2 size={14} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-1 text-red-500"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {onToggleActive && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Status
            </span>
            <button
              type="button"
              disabled={isTogglingActive}
              onClick={(e) => {
                e.stopPropagation();
                onToggleActive(!item.isActive);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition-colors disabled:opacity-60 ${
                item.isActive
                  ? "bg-[#98E32F] text-[#013644]"
                  : "bg-neutral-200 text-neutral-600"
              }`}
              title={item.isActive ? "Set inactive" : "Set active"}
            >
              {isTogglingActive ? (
                <Loader2 size={12} className="animate-spin" />
              ) : null}
              {item.isActive ? "Active" : "Off"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
