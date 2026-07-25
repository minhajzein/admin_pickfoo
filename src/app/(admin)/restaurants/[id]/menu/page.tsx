"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, XCircle } from "lucide-react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { RestaurantProfileHero } from "@/components/restaurants/RestaurantProfileHero";
import { RestaurantMenuPanel } from "@/components/restaurants/RestaurantMenuPanel";
import { fetchRestaurantMenu } from "@/lib/api/menu";

export default function ManageRestaurantMenuPage() {
  const { id } = useParams();
  const router = useRouter();
  const restaurantId = String(id ?? "");

  const { data: restaurant, isLoading, isError } = useQuery({
    queryKey: ["restaurant", restaurantId],
    queryFn: async () => {
      const response = await api.get(`/restaurants/${restaurantId}`);
      return response.data.data;
    },
    enabled: !!restaurantId,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ["restaurant-menu", restaurantId],
    queryFn: () => fetchRestaurantMenu(restaurantId),
    enabled: !!restaurantId,
  });

  const categoryHint = (() => {
    const counts = new Map<string, number>();
    for (const item of menuItems) {
      const c = (item.category || "").trim();
      if (!c) continue;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    let best = "";
    let max = 0;
    for (const [name, n] of counts) {
      if (n > max) {
        max = n;
        best = name;
      }
    }
    return best || undefined;
  })();

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-white/40">
        <Loader2 className="animate-spin text-[#98E32F]" size={40} />
        <p className="font-medium animate-pulse">Loading restaurant menu...</p>
      </div>
    );
  }

  if (isError || !restaurant) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-white/40">
        <XCircle size={48} className="text-red-500/50" />
        <p className="font-bold text-xl">Restaurant not found</p>
        <Button
          onClick={() => router.push("/restaurants")}
          variant="outline"
          className="border-white/10"
        >
          Back to list
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/restaurants")}
            className="rounded-2xl bg-white/5 border border-white/10 hover:bg-[#98E32F]/10 hover:text-[#98E32F] transition-all"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Manage menu
            </h1>
            <p className="text-white/40 text-sm mt-0.5">
              Customer-style preview with full add / edit controls
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-white/10 text-white hover:bg-white/5"
          onClick={() => router.push(`/restaurants/verify/${restaurantId}`)}
        >
          Verify documents
        </Button>
      </div>

      <RestaurantProfileHero
        restaurant={restaurant}
        categoryHint={categoryHint}
      />

      <RestaurantMenuPanel
        restaurantId={restaurantId}
        restaurantName={restaurant.name}
        restaurantTypes={
          Array.isArray(restaurant.restaurantTypes) &&
          restaurant.restaurantTypes.length > 0
            ? restaurant.restaurantTypes
            : ["restaurant"]
        }
      />
    </div>
  );
}
