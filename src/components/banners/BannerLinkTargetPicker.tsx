"use client";

import { memo, startTransition, useCallback, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  searchBannerMenuItems,
  searchBannerRestaurants,
  type BannerMenuItemOption,
  type BannerRestaurantOption,
  type HomeBannerLinkType,
} from "@/lib/api/banners";
import { cn } from "@/lib/utils";

export type LinkTargetValue = {
  restaurantId: string;
  menuItemId: string;
  menuItemIds: string[];
};

function apiErrorMessage(error: unknown, fallback: string) {
  if (
    axios.isAxiosError(error) &&
    typeof error.response?.data?.message === "string"
  ) {
    return error.response.data.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

const OptionChip = memo(function OptionChip({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-md border px-2.5 py-1 text-left text-xs font-medium",
        selected
          ? "border-[#98E32F]/50 bg-[#98E32F] text-[#013644]"
          : "border-white/15 bg-transparent text-white/80 hover:bg-white/5",
      )}
    >
      {label}
    </button>
  );
});

/**
 * Search inputs are uncontrolled so keystrokes never re-render option chips.
 * Selection state is local; parent is notified via startTransition.
 */
export function BannerLinkTargetPicker({
  linkType,
  value,
  onChange,
}: {
  linkType: HomeBannerLinkType;
  value: LinkTargetValue;
  onChange: (next: LinkTargetValue) => void;
}) {
  const restaurantSearchRef = useRef<HTMLInputElement>(null);
  const dishSearchRef = useRef<HTMLInputElement>(null);
  const [restaurantOptions, setRestaurantOptions] = useState<
    BannerRestaurantOption[]
  >([]);
  const [dishOptions, setDishOptions] = useState<BannerMenuItemOption[]>([]);
  const [searchingRestaurants, setSearchingRestaurants] = useState(false);
  const [searchingDishes, setSearchingDishes] = useState(false);

  // Local mirror so chip clicks paint immediately; parent notified in transition.
  const [local, setLocal] = useState<LinkTargetValue>(value);
  const localRef = useRef(local);
  localRef.current = local;

  const selectedDishSet = useMemo(
    () => new Set(local.menuItemIds),
    [local.menuItemIds],
  );

  const commit = useCallback(
    (next: LinkTargetValue) => {
      setLocal(next);
      localRef.current = next;
      startTransition(() => onChange(next));
    },
    [onChange],
  );

  const loadRestaurants = async () => {
    const q = restaurantSearchRef.current?.value?.trim() ?? "";
    setSearchingRestaurants(true);
    try {
      const rows = await searchBannerRestaurants(q);
      // Defer painting a large chip list so the Search button feedback stays snappy.
      startTransition(() => {
        setRestaurantOptions(rows);
        setSearchingRestaurants(false);
      });
      if (rows.length === 0) {
        toast.message("No restaurants found", {
          description:
            "Try a different name or check status on the Restaurants page.",
        });
      }
    } catch (error: unknown) {
      setSearchingRestaurants(false);
      toast.error(apiErrorMessage(error, "Failed to search restaurants"));
    }
  };

  const loadDishes = async () => {
    const q = dishSearchRef.current?.value?.trim() ?? "";
    setSearchingDishes(true);
    try {
      const rows = await searchBannerMenuItems({
        search: q,
        restaurantId: localRef.current.restaurantId || undefined,
      });
      startTransition(() => {
        setDishOptions(rows);
        setSearchingDishes(false);
      });
      if (rows.length === 0) {
        toast.message("No dishes found", {
          description: "Try another name or pick a restaurant filter first.",
        });
      }
    } catch (error: unknown) {
      setSearchingDishes(false);
      toast.error(apiErrorMessage(error, "Failed to search dishes"));
    }
  };

  const selectRestaurant = useCallback(
    (id: string) => {
      commit({ ...localRef.current, restaurantId: id });
    },
    [commit],
  );

  const selectDish = useCallback(
    (id: string) => {
      commit({ ...localRef.current, menuItemId: id });
    },
    [commit],
  );

  const toggleDish = useCallback(
    (id: string) => {
      const set = new Set(localRef.current.menuItemIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      commit({ ...localRef.current, menuItemIds: Array.from(set) });
    },
    [commit],
  );

  if (linkType === "none") return null;

  const showRestaurant =
    linkType === "restaurant" || linkType === "dish" || linkType === "dishes";

  return (
    <>
      {showRestaurant && (
        <div className="space-y-2 rounded-lg border border-white/10 p-4 contain-layout">
          <Label>Restaurant (optional for dishes filter)</Label>
          <div className="flex gap-2">
            <Input
              ref={restaurantSearchRef}
              defaultValue=""
              placeholder="Search restaurant name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void loadRestaurants();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={searchingRestaurants}
              onClick={() => void loadRestaurants()}
            >
              {searchingRestaurants ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </div>
          {restaurantOptions.length > 0 && (
            <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {restaurantOptions.map((r) => (
                <OptionChip
                  key={r.id}
                  selected={local.restaurantId === r.id}
                  label={r.name}
                  onSelect={() => selectRestaurant(r.id)}
                />
              ))}
            </div>
          )}
          {local.restaurantId ? (
            <p className="text-xs text-white/50">Selected: {local.restaurantId}</p>
          ) : null}
        </div>
      )}

      {linkType === "dish" && (
        <div className="space-y-2 rounded-lg border border-white/10 p-4 contain-layout">
          <Label>Select one dish</Label>
          <div className="flex gap-2">
            <Input
              ref={dishSearchRef}
              defaultValue=""
              placeholder="Search dish name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void loadDishes();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={searchingDishes}
              onClick={() => void loadDishes()}
            >
              {searchingDishes ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </div>
          <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {dishOptions.map((d) => (
              <OptionChip
                key={d.id}
                selected={local.menuItemId === d.id}
                label={`${d.name} (₹${d.price})`}
                onSelect={() => selectDish(d.id)}
              />
            ))}
          </div>
        </div>
      )}

      {linkType === "dishes" && (
        <div className="space-y-2 rounded-lg border border-white/10 p-4 contain-layout">
          <Label>Select dishes (multi)</Label>
          <div className="flex gap-2">
            <Input
              ref={dishSearchRef}
              defaultValue=""
              placeholder="Search dish name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void loadDishes();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={searchingDishes}
              onClick={() => void loadDishes()}
            >
              {searchingDishes ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </div>
          <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {dishOptions.map((d) => (
              <OptionChip
                key={d.id}
                selected={selectedDishSet.has(d.id)}
                label={d.name}
                onSelect={() => toggleDish(d.id)}
              />
            ))}
          </div>
          <p className="text-xs text-white/50">
            Selected: {local.menuItemIds.length} dish(es)
          </p>
        </div>
      )}
    </>
  );
}
