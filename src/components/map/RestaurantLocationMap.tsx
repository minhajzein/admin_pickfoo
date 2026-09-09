"use client";

import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import { ExternalLink, MapPin, Store } from "lucide-react";
import { mapboxMapLib } from "@/lib/mapbox";

export function RestaurantLocationMap({
  lat,
  lng,
  name,
  className = "h-60",
}: {
  lat: number;
  lng: number;
  name: string;
  className?: string;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
  const valid =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;
  const mapsUrl = valid
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
    : "";

  if (!valid) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/15 text-sm text-white/40">
        <MapPin className="mr-2 h-4 w-4" />
        Map pin not available
      </div>
    );
  }

  if (!token) {
    return (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-32 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-sm text-[#98E32F] hover:bg-white/5"
      >
        <MapPin className="mr-2 h-4 w-4" />
        Open restaurant location
        <ExternalLink className="ml-2 h-3.5 w-3.5" />
      </a>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className={`relative overflow-hidden rounded-lg border border-white/10 ${className}`}
      >
        <Map
          mapLib={mapboxMapLib}
          mapboxAccessToken={token}
          initialViewState={{ longitude: lng, latitude: lat, zoom: 15 }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <NavigationControl position="top-right" />
          <Marker longitude={lng} latitude={lat}>
            <span
              title={name}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#98E32F] text-[#013644] shadow-lg"
            >
              <Store className="h-4 w-4" />
            </span>
          </Marker>
        </Map>
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-xs text-[#98E32F] hover:underline"
      >
        Open in Google Maps
        <ExternalLink className="ml-1 h-3 w-3" />
      </a>
    </div>
  );
}
