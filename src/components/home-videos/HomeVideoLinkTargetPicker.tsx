"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  searchHomeVideoCategories,
  searchHomeVideoMenuItems,
  searchHomeVideoOffers,
  searchHomeVideoRestaurants,
  type HomeVideoCategoryOption,
  type HomeVideoLinkType,
  type HomeVideoMenuItemOption,
  type HomeVideoOfferOption,
  type HomeVideoRestaurantOption,
} from "@/lib/api/homeVideos";
import { cn } from "@/lib/utils";

export type HomeVideoLinkTargetValue = {
  restaurantId: string;
  menuItemId: string;
  menuItemIds: string[];
  categoryId: string;
  categoryName: string;
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

export function HomeVideoLinkTargetPicker({
  linkType,
  value,
  onChange,
}: {
  linkType: HomeVideoLinkType;
  value: HomeVideoLinkTargetValue;
  onChange: (next: HomeVideoLinkTargetValue) => void;
}) {
  const restaurantSearchRef = useRef<HTMLInputElement>(null);
  const dishSearchRef = useRef<HTMLInputElement>(null);
  const categorySearchRef = useRef<HTMLInputElement>(null);
  const offerSearchRef = useRef<HTMLInputElement>(null);
  const [restaurantOptions, setRestaurantOptions] = useState<
    HomeVideoRestaurantOption[]
  >([]);
  const [dishOptions, setDishOptions] = useState<HomeVideoMenuItemOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<
    HomeVideoCategoryOption[]
  >([]);
  const [offerOptions, setOfferOptions] = useState<HomeVideoOfferOption[]>([]);
  const [searchingRestaurants, setSearchingRestaurants] = useState(false);
  const [searchingDishes, setSearchingDishes] = useState(false);
  const [searchingCategories, setSearchingCategories] = useState(false);
  const [searchingOffers, setSearchingOffers] = useState(false);
  const [hydrating, setHydrating] = useState(true);

  const [local, setLocal] = useState<HomeVideoLinkTargetValue>(value);
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
  const selectedCategory = categoryOptions.find(
    (c) => c.id === local.categoryId,
  );
  const selectedOffer = offerOptions.find((o) => o.id === local.offerId);

  const commit = useCallback(
    (next: HomeVideoLinkTargetValue) => {
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
        const dishIds = [...value.menuItemIds, value.menuItemId].filter(
          (id, i, arr) => id && arr.indexOf(id) === i,
        );
        const categoryId = value.categoryId.trim();
        const offerId = value.offerId.trim();

        const [restaurants, dishes, categories, offers] = await Promise.all([
          restaurantId
            ? searchHomeVideoRestaurants("", { ids: [restaurantId] })
            : Promise.resolve([]),
          dishIds.length
            ? searchHomeVideoMenuItems({ ids: dishIds })
            : Promise.resolve([]),
          categoryId
            ? searchHomeVideoCategories("", { ids: [categoryId] })
            : Promise.resolve([]),
          offerId
            ? searchHomeVideoOffers("", { ids: [offerId] })
            : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setRestaurantOptions(restaurants);
        setDishOptions(dishes);
        setCategoryOptions(categories);
        setOfferOptions(offers);
      } catch (error: unknown) {
        if (!cancelled) {
          toast.error(
            apiErrorMessage(error, "Failed to load saved link targets"),
          );
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRestaurants = async () => {
    const q = restaurantSearchRef.current?.value?.trim() ?? "";
    setSearchingRestaurants(true);
    try {
      const rows = await searchHomeVideoRestaurants(q);
      setRestaurantOptions((prev) => {
        const selected = prev.filter(
          (r) => r.id === localRef.current.restaurantId,
        );
        return mergeById(rows, selected);
      });
      if (rows.length === 0) toast.message("No restaurants found");
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
      const rows = await searchHomeVideoMenuItems({
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
      if (rows.length === 0) toast.message("No dishes found");
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, "Failed to search dishes"));
    } finally {
      setSearchingDishes(false);
    }
  };

  const loadCategories = async () => {
    const q = categorySearchRef.current?.value?.trim() ?? "";
    setSearchingCategories(true);
    try {
      const rows = await searchHomeVideoCategories(q);
      setCategoryOptions((prev) => {
        const selected = prev.filter(
          (c) => c.id === localRef.current.categoryId,
        );
        return mergeById(rows, selected);
      });
      if (rows.length === 0) toast.message("No categories found");
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, "Failed to search categories"));
    } finally {
      setSearchingCategories(false);
    }
  };

  const loadOffers = async () => {
    const q = offerSearchRef.current?.value?.trim() ?? "";
    setSearchingOffers(true);
    try {
      const rows = await searchHomeVideoOffers(q);
      setOfferOptions((prev) => {
        const selected = prev.filter((o) => o.id === localRef.current.offerId);
        return mergeById(rows, selected);
      });
      if (rows.length === 0) toast.message("No offers found");
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, "Failed to search offers"));
    } finally {
      setSearchingOffers(false);
    }
  };

  if (linkType === "none") return null;

  if (linkType === "offer") {
    return (
      <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
        <Label>Customer offer</Label>
        {hydrating ? (
          <p className="text-xs text-white/40">Loading saved offer…</p>
        ) : local.offerId ? (
          <p className="text-xs text-[#98E32F]">
            Selected: {selectedOffer?.title || local.offerId}
          </p>
        ) : (
          <p className="text-xs text-amber-300/90">No offer selected yet</p>
        )}
        <div className="flex gap-2">
          <Input
            ref={offerSearchRef}
            placeholder="Search offers"
            defaultValue=""
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
        <div className="flex flex-wrap gap-2">
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

  if (linkType === "category") {
    return (
      <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
        <Label>Category</Label>
        {hydrating ? (
          <p className="text-xs text-white/40">Loading saved category…</p>
        ) : local.categoryId ? (
          <p className="text-xs text-[#98E32F]">
            Selected:{" "}
            {selectedCategory?.name || local.categoryName || local.categoryId}
          </p>
        ) : (
          <p className="text-xs text-amber-300/90">No category selected yet</p>
        )}
        <div className="flex gap-2">
          <Input
            ref={categorySearchRef}
            placeholder="Search categories"
            defaultValue=""
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void loadCategories();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={searchingCategories}
            onClick={() => void loadCategories()}
          >
            {searchingCategories ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((c) => (
            <OptionChip
              key={c.id}
              selected={local.categoryId === c.id}
              label={c.name}
              onSelect={() =>
                commit({
                  ...localRef.current,
                  categoryId: c.id,
                  categoryName: c.name,
                })
              }
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
      {(linkType === "restaurant" ||
        linkType === "dish" ||
        linkType === "dishes") && (
        <div className="space-y-2">
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
              placeholder="Search restaurants"
              defaultValue=""
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
          <div className="flex flex-wrap gap-2">
            {restaurantOptions.map((r) => (
              <OptionChip
                key={r.id}
                selected={local.restaurantId === r.id}
                label={`${r.name}${r.city ? ` · ${r.city}` : ""}`}
                onSelect={() =>
                  commit({
                    ...localRef.current,
                    restaurantId: r.id,
                  })
                }
              />
            ))}
          </div>
        </div>
      )}

      {(linkType === "dish" || linkType === "dishes") && (
        <div className="space-y-2">
          <Label>
            {linkType === "dish" ? "Select one dish" : "Select dishes (multi)"}
          </Label>
          {hydrating ? (
            <p className="text-xs text-white/40">Loading saved dishes…</p>
          ) : linkType === "dish" ? (
            local.menuItemId ? (
              <p className="text-xs text-[#98E32F]">
                Selected: {selectedSingleDish?.name || local.menuItemId}
              </p>
            ) : (
              <p className="text-xs text-amber-300/90">No dish selected yet</p>
            )
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
              placeholder="Search dishes"
              defaultValue=""
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
          <div className="flex flex-wrap gap-2">
            {dishOptions.map((d) => {
              const selected =
                linkType === "dish"
                  ? local.menuItemId === d.id
                  : selectedDishSet.has(d.id);
              return (
                <OptionChip
                  key={d.id}
                  selected={selected}
                  label={`${d.name} · ₹${d.price}`}
                  onSelect={() => {
                    if (linkType === "dish") {
                      commit({
                        ...localRef.current,
                        menuItemId: d.id,
                        menuItemIds: [],
                      });
                      return;
                    }
                    const cur = localRef.current;
                    const set = new Set(cur.menuItemIds);
                    if (set.has(d.id)) set.delete(d.id);
                    else set.add(d.id);
                    commit({
                      ...cur,
                      menuItemIds: Array.from(set),
                      menuItemId: "",
                    });
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
