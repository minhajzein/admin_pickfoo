"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  searchBannerMenuItems,
  searchBannerOffers,
  searchBannerRestaurants,
  type BannerMenuItemOption,
  type BannerOfferOption,
  type BannerRestaurantOption,
  type HomeBannerLinkType,
} from "@/lib/api/banners";
import { cn } from "@/lib/utils";

export type LinkTargetValue = {
  restaurantId: string;
  menuItemId: string;
  menuItemIds: string[];
  offerId: string;
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

function mergeById<T extends { id: string }>(primary: T[], extra: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of extra) map.set(row.id, row);
  for (const row of primary) map.set(row.id, row);
  return [...map.values()];
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
 * Selection is committed synchronously so Save reads the latest ids.
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
  const offerSearchRef = useRef<HTMLInputElement>(null);
  const [restaurantOptions, setRestaurantOptions] = useState<
    BannerRestaurantOption[]
  >([]);
  const [dishOptions, setDishOptions] = useState<BannerMenuItemOption[]>([]);
  const [offerOptions, setOfferOptions] = useState<BannerOfferOption[]>([]);
  const [searchingRestaurants, setSearchingRestaurants] = useState(false);
  const [searchingDishes, setSearchingDishes] = useState(false);
  const [searchingOffers, setSearchingOffers] = useState(false);
  const [hydrating, setHydrating] = useState(true);

  const [local, setLocal] = useState<LinkTargetValue>(value);
  const localRef = useRef(local);
  localRef.current = local;

  const selectedDishSet = useMemo(
    () => new Set(local.menuItemIds),
    [local.menuItemIds],
  );

  const selectedRestaurant = restaurantOptions.find(
    (r) => r.id === local.restaurantId,
  );
  const selectedSingleDish = dishOptions.find((d) => d.id === local.menuItemId);

  const commit = useCallback(
    (next: LinkTargetValue) => {
      setLocal(next);
      localRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const restaurantId = value.restaurantId.trim();
        const dishIds = [
          ...value.menuItemIds,
          value.menuItemId,
        ].filter((id, i, arr) => id && arr.indexOf(id) === i);
        const offerId = value.offerId.trim();

        const [restaurants, dishes, offers] = await Promise.all([
          restaurantId
            ? searchBannerRestaurants("", { ids: [restaurantId] })
            : Promise.resolve([]),
          dishIds.length
            ? searchBannerMenuItems({ ids: dishIds })
            : Promise.resolve([]),
          offerId ? searchBannerOffers("") : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setRestaurantOptions(restaurants);
        setDishOptions(dishes);
        if (offerId) {
          setOfferOptions(offers.filter((o) => o.id === offerId));
        }
      } catch (error: unknown) {
        if (!cancelled) {
          toast.error(apiErrorMessage(error, "Failed to load saved link targets"));
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
    // Only hydrate from the initial editor value (picker remounts on link type change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRestaurants = async () => {
    const q = restaurantSearchRef.current?.value?.trim() ?? "";
    setSearchingRestaurants(true);
    try {
      const rows = await searchBannerRestaurants(q);
      setRestaurantOptions((prev) => {
        const selected = prev.filter(
          (r) => r.id === localRef.current.restaurantId,
        );
        return mergeById(rows, selected);
      });
      if (rows.length === 0) {
        toast.message("No restaurants found", {
          description:
            "Try a different name or check status on the Restaurants page.",
        });
      }
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, "Failed to search restaurants"));
    } finally {
      setSearchingRestaurants(false);
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
      const keepIds = new Set([
        ...localRef.current.menuItemIds,
        localRef.current.menuItemId,
      ]);
      setDishOptions((prev) => {
        const kept = prev.filter((d) => keepIds.has(d.id));
        return mergeById(rows, kept);
      });
      if (rows.length === 0) {
        toast.message("No dishes found", {
          description: "Try another name or pick a restaurant filter first.",
        });
      }
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, "Failed to search dishes"));
    } finally {
      setSearchingDishes(false);
    }
  };

  const loadOffers = async () => {
    const q = offerSearchRef.current?.value?.trim() ?? "";
    setSearchingOffers(true);
    try {
      const rows = await searchBannerOffers(q);
      setOfferOptions((prev) => {
        const selected = prev.filter((o) => o.id === localRef.current.offerId);
        return mergeById(rows, selected);
      });
      if (rows.length === 0) {
        toast.message("No offers found");
      }
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, "Failed to search offers"));
    } finally {
      setSearchingOffers(false);
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

  if (linkType === "offer") {
    return (
      <div className="space-y-2 rounded-lg border border-white/10 p-4 contain-layout">
        <Label>Select customer offer</Label>
        {hydrating ? (
          <p className="text-xs text-white/40">Loading saved offer…</p>
        ) : local.offerId ? (
          <p className="text-xs text-[#98E32F]">
            Selected:{" "}
            {offerOptions.find((o) => o.id === local.offerId)?.title ||
              local.offerId}
          </p>
        ) : (
          <p className="text-xs text-amber-300/90">No offer selected yet</p>
        )}
        <div className="flex gap-2">
          <Input
            ref={offerSearchRef}
            defaultValue=""
            placeholder="Search offer title or code"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void loadOffers();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={searchingOffers}
            onClick={() => void loadOffers()}
          >
            {searchingOffers ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </div>
        <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
          {offerOptions.map((o) => (
            <OptionChip
              key={o.id}
              selected={local.offerId === o.id}
              label={`${o.title}${o.badgeLabel ? ` · ${o.badgeLabel}` : ""}`}
              onSelect={() => commit({ ...localRef.current, offerId: o.id })}
            />
          ))}
        </div>
      </div>
    );
  }

  const showRestaurant =
    linkType === "restaurant" || linkType === "dish" || linkType === "dishes";

  return (
    <>
      {showRestaurant && (
        <div className="space-y-2 rounded-lg border border-white/10 p-4 contain-layout">
          <Label>
            {linkType === "restaurant"
              ? "Select restaurant"
              : "Restaurant (optional filter for dishes)"}
          </Label>
          {hydrating ? (
            <p className="text-xs text-white/40">Loading saved restaurant…</p>
          ) : local.restaurantId ? (
            <p className="text-xs text-[#98E32F]">
              Selected: {selectedRestaurant?.name || local.restaurantId}
            </p>
          ) : (
            <p className="text-xs text-amber-300/90">
              {linkType === "restaurant"
                ? "Select a restaurant to save"
                : "No restaurant selected"}
            </p>
          )}
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
        </div>
      )}

      {linkType === "dish" && (
        <div className="space-y-2 rounded-lg border border-white/10 p-4 contain-layout">
          <Label>Select one dish</Label>
          {hydrating ? (
            <p className="text-xs text-white/40">Loading saved dish…</p>
          ) : local.menuItemId ? (
            <p className="text-xs text-[#98E32F]">
              Selected: {selectedSingleDish?.name || local.menuItemId}
            </p>
          ) : (
            <p className="text-xs text-amber-300/90">No dish selected yet</p>
          )}
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
          {hydrating ? (
            <p className="text-xs text-white/40">Loading saved dishes…</p>
          ) : (
            <p className="text-xs text-[#98E32F]">
              Selected: {local.menuItemIds.length} dish(es)
              {dishOptions.filter((d) => selectedDishSet.has(d.id)).length
                ? ` · ${dishOptions
                    .filter((d) => selectedDishSet.has(d.id))
                    .map((d) => d.name)
                    .join(", ")}`
                : ""}
            </p>
          )}
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
        </div>
      )}
    </>
  );
}
