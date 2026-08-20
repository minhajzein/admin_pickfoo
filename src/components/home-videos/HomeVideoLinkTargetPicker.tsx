"use client";

import { memo, startTransition, useCallback, useMemo, useRef, useState } from "react";
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

  const [local, setLocal] = useState<HomeVideoLinkTargetValue>(value);
  const localRef = useRef(local);
  localRef.current = local;

  const selectedDishSet = useMemo(
    () => new Set(local.menuItemIds),
    [local.menuItemIds],
  );

  const commit = useCallback(
    (next: HomeVideoLinkTargetValue) => {
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
      const rows = await searchHomeVideoRestaurants(q);
      startTransition(() => {
        setRestaurantOptions(rows);
        setSearchingRestaurants(false);
      });
      if (rows.length === 0) {
        toast.message("No restaurants found");
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
      const rows = await searchHomeVideoMenuItems({
        search: q,
        restaurantId: localRef.current.restaurantId || undefined,
      });
      startTransition(() => {
        setDishOptions(rows);
        setSearchingDishes(false);
      });
      if (rows.length === 0) {
        toast.message("No dishes found");
      }
    } catch (error: unknown) {
      setSearchingDishes(false);
      toast.error(apiErrorMessage(error, "Failed to search dishes"));
    }
  };

  const loadCategories = async () => {
    const q = categorySearchRef.current?.value?.trim() ?? "";
    setSearchingCategories(true);
    try {
      const rows = await searchHomeVideoCategories(q);
      startTransition(() => {
        setCategoryOptions(rows);
        setSearchingCategories(false);
      });
      if (rows.length === 0) {
        toast.message("No categories found");
      }
    } catch (error: unknown) {
      setSearchingCategories(false);
      toast.error(apiErrorMessage(error, "Failed to search categories"));
    }
  };

  const loadOffers = async () => {
    const q = offerSearchRef.current?.value?.trim() ?? "";
    setSearchingOffers(true);
    try {
      const rows = await searchHomeVideoOffers(q);
      startTransition(() => {
        setOfferOptions(rows);
        setSearchingOffers(false);
      });
      if (rows.length === 0) {
        toast.message("No offers found");
      }
    } catch (error: unknown) {
      setSearchingOffers(false);
      toast.error(apiErrorMessage(error, "Failed to search offers"));
    }
  };

  if (linkType === "none") return null;

  if (linkType === "offer") {
    return (
      <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="space-y-2">
          <Label>Customer offer</Label>
          <div className="flex gap-2">
            <Input
              ref={offerSearchRef}
              placeholder="Search offers"
              defaultValue=""
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
          {local.offerId ? (
            <p className="text-xs text-white/60">
              Selected: <span className="text-white/90">{local.offerId}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {offerOptions.map((o) => (
              <OptionChip
                key={o.id}
                selected={local.offerId === o.id}
                label={`${o.title}${o.badgeLabel ? ` · ${o.badgeLabel}` : ""}`}
                onSelect={() =>
                  commit({ ...localRef.current, offerId: o.id })
                }
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (linkType === "category") {
    return (
      <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="space-y-2">
          <Label>Category</Label>
          <div className="flex gap-2">
            <Input
              ref={categorySearchRef}
              placeholder="Search categories"
              defaultValue=""
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
          {local.categoryId ? (
            <p className="text-xs text-white/60">
              Selected:{" "}
              <span className="text-white/90">
                {local.categoryName || local.categoryId}
              </span>
            </p>
          ) : null}
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
              ? "Restaurant"
              : "Restaurant (optional filter)"}
          </Label>
          <div className="flex gap-2">
            <Input
              ref={restaurantSearchRef}
              placeholder="Search restaurants"
              defaultValue=""
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
          {local.restaurantId ? (
            <p className="text-xs text-white/60">
              Selected restaurant id:{" "}
              <span className="text-white/90">{local.restaurantId}</span>
            </p>
          ) : null}
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
                    menuItemId: "",
                    menuItemIds: [],
                  })
                }
              />
            ))}
          </div>
        </div>
      )}

      {(linkType === "dish" || linkType === "dishes") && (
        <div className="space-y-2">
          <Label>{linkType === "dish" ? "Dish" : "Dishes"}</Label>
          <div className="flex gap-2">
            <Input
              ref={dishSearchRef}
              placeholder="Search dishes"
              defaultValue=""
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
                    const nextIds = selectedDishSet.has(d.id)
                      ? cur.menuItemIds.filter((id) => id !== d.id)
                      : [...cur.menuItemIds, d.id];
                    commit({ ...cur, menuItemIds: nextIds, menuItemId: "" });
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
