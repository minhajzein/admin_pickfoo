"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import MapGL, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from "react-map-gl/mapbox";
import type { LineLayerSpecification } from "mapbox-gl";
import { mapboxMapLib } from "@/lib/mapbox";
import { Loader2, MapPin, Store } from "lucide-react";
import {
  fetchDispatchOrderRoute,
  type AdminOrderRoute,
} from "@/lib/api/orders";

function formatDuration(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const routeLine: LineLayerSpecification = {
  id: "order-driving-route",
  type: "line",
  source: "order-driving-route-source",
  paint: {
    "line-color": "#98E32F",
    "line-width": 5,
    "line-opacity": 0.9,
  },
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
};

function fitRoute(
  map: MapRef | null,
  route: AdminOrderRoute,
) {
  const points = [
    route.origin,
    route.destination,
    ...route.geometry.coordinates.map(([lng, lat]) => ({ lng, lat })),
  ];
  if (!map || points.length === 0) return;

  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  for (const point of points) {
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
  }

  if (minLng === maxLng && minLat === maxLat) {
    map.flyTo({ center: [minLng, minLat], zoom: 14, duration: 0 });
    return;
  }
  map.fitBounds(
    [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    { padding: 52, maxZoom: 14, duration: 0 },
  );
}

export default function OrderRouteMap({ orderRef }: { orderRef: string }) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
  const mapRef = useRef<MapRef>(null);
  const fittedRef = useRef("");
  const { data: route, isLoading, error } = useQuery({
    queryKey: ["orders", "route", orderRef],
    queryFn: () => fetchDispatchOrderRoute(orderRef),
    enabled: Boolean(orderRef),
    staleTime: 60_000,
    retry: 1,
  });

  const routeGeoJson = useMemo(
    () =>
      route
        ? {
            type: "Feature" as const,
            properties: {},
            geometry: route.geometry,
          }
        : null,
    [route],
  );

  useEffect(() => {
    if (!route || fittedRef.current === route.computedAt) return;
    const map = mapRef.current;
    if (!map) return;
    requestAnimationFrame(() => {
      fitRoute(mapRef.current, route);
      fittedRef.current = route.computedAt;
    });
  }, [route]);

  if (!token) {
    return (
      <p className="py-8 text-center text-sm text-amber-300">
        Map view is unavailable: configure NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.
      </p>
    );
  }
  if (isLoading) {
    return (
      <div className="flex h-[320px] items-center justify-center text-white/50">
        <Loader2 className="h-7 w-7 animate-spin text-[#98E32F]" />
      </div>
    );
  }
  if (!route) {
    const message =
      error instanceof Error
        ? error.message
        : "The restaurant or customer map pin is unavailable.";
    return <p className="py-8 text-center text-sm text-white/50">{message}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-xs text-white/50">Driving distance</p>
          <p className="mt-1 text-xl font-semibold text-[#98E32F]">
            {route.distanceKm.toFixed(2)} km
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-xs text-white/50">Estimated drive</p>
          <p className="mt-1 text-xl font-semibold text-white">
            {formatDuration(route.durationSeconds)}
          </p>
        </div>
      </div>
      <div className="relative h-[320px] overflow-hidden rounded-lg border border-white/10">
        <MapGL
          ref={mapRef}
          mapLib={mapboxMapLib}
          mapboxAccessToken={token}
          initialViewState={{
            longitude: route.origin.lng,
            latitude: route.origin.lat,
            zoom: 12,
          }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          onLoad={() => {
            mapRef.current?.resize();
            fitRoute(mapRef.current, route);
          }}
        >
          <NavigationControl position="top-right" />
          {routeGeoJson ? (
            <Source id="order-driving-route-source" type="geojson" data={routeGeoJson}>
              <Layer {...routeLine} />
            </Source>
          ) : null}
          <Marker longitude={route.origin.lng} latitude={route.origin.lat}>
            <span
              title="Restaurant"
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#98E32F] text-[#013644] shadow-lg"
            >
              <Store className="h-4 w-4" />
            </span>
          </Marker>
          <Marker longitude={route.destination.lng} latitude={route.destination.lat}>
            <span
              title="Customer delivery address"
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-red-500 text-white shadow-lg"
            >
              <MapPin className="h-4 w-4" />
            </span>
          </Marker>
        </MapGL>
      </div>
      <p className="text-xs text-white/45">
        Current driving route via OSRM. Distance is not a billing snapshot and may
        change with road data.
      </p>
    </div>
  );
}
