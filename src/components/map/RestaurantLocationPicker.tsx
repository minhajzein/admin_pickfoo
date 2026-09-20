"use client";

import { useEffect, useRef, useState } from "react";
import Map, {
  Marker,
  NavigationControl,
  type MapRef,
} from "react-map-gl/mapbox";
import { Loader2, MapPin, Search, Store } from "lucide-react";
import { mapboxMapLib } from "@/lib/mapbox";

const WAYANAD = { longitude: 76.132, latitude: 11.685, zoom: 12 };

export type RestaurantMapPoint = { lat: number; lng: number };

export type RestaurantAddressHint = {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
};

type GeocodeHit = RestaurantMapPoint &
  RestaurantAddressHint & {
    id: string;
    label: string;
  };

function isValidPoint(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function parseGeocodeFeature(raw: {
  id?: string;
  place_name?: string;
  text?: string;
  address?: string;
  center?: number[];
  context?: { id?: string; text?: string }[];
}): GeocodeHit | null {
  const lng = Number(raw.center?.[0]);
  const lat = Number(raw.center?.[1]);
  if (!isValidPoint(lat, lng)) return null;
  const ctx = raw.context ?? [];
  const find = (prefix: string) =>
    ctx.find((c) => String(c.id ?? "").startsWith(prefix))?.text?.trim() ||
    undefined;
  const street = [raw.address, raw.text].filter(Boolean).join(" ").trim();
  return {
    id: String(raw.id ?? `${lat},${lng}`),
    label: raw.place_name || raw.text || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    lat,
    lng,
    street: street || undefined,
    city: find("place") || find("locality") || find("district"),
    state: find("region"),
    zipCode: find("postcode"),
  };
}

export function RestaurantLocationPicker({
  lat,
  lng,
  name,
  disabled,
  onChange,
  onAddressHint,
}: {
  lat: number | null;
  lng: number | null;
  name: string;
  disabled?: boolean;
  onChange: (point: RestaurantMapPoint) => void;
  onAddressHint?: (hint: RestaurantAddressHint) => void;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
  const mapRef = useRef<MapRef>(null);
  const hasPin = lat != null && lng != null && isValidPoint(lat, lng);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [latInput, setLatInput] = useState(hasPin ? String(lat) : "");
  const [lngInput, setLngInput] = useState(hasPin ? String(lng) : "");

  useEffect(() => {
    setLatInput(hasPin ? Number(lat).toFixed(6) : "");
    setLngInput(hasPin ? Number(lng).toFixed(6) : "");
  }, [hasPin, lat, lng]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || !token) {
      setHits([]);
      setSearching(false);
      return;
    }
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const proximity = hasPin
          ? `${lng},${lat}`
          : `${WAYANAD.longitude},${WAYANAD.latitude}`;
        const url = new URL(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`,
        );
        url.searchParams.set("access_token", token);
        url.searchParams.set("country", "IN");
        url.searchParams.set("limit", "5");
        url.searchParams.set("proximity", proximity);
        url.searchParams.set("language", "en");
        const res = await fetch(url.toString());
        const json = (await res.json()) as {
          features?: Parameters<typeof parseGeocodeFeature>[0][];
        };
        setHits(
          (json.features ?? [])
            .map(parseGeocodeFeature)
            .filter((h): h is GeocodeHit => h != null),
        );
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [query, token, hasPin, lat, lng]);

  const flyTo = (point: RestaurantMapPoint, zoom = 16) => {
    mapRef.current?.flyTo({
      center: [point.lng, point.lat],
      zoom,
      duration: 700,
    });
  };

  const applyPoint = (
    point: RestaurantMapPoint,
    hint?: RestaurantAddressHint,
    shouldFly = false,
  ) => {
    if (!isValidPoint(point.lat, point.lng) || disabled) return;
    onChange(point);
    if (hint) onAddressHint?.(hint);
    if (shouldFly) flyTo(point);
  };

  const commitManualCoords = () => {
    const nextLat = Number(latInput);
    const nextLng = Number(lngInput);
    if (!isValidPoint(nextLat, nextLng)) return;
    applyPoint({ lat: nextLat, lng: nextLng }, undefined, true);
  };

  return (
    <div className="space-y-3">
      {token ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="search"
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a place, street, or landmark"
            className="w-full rounded-lg border border-white/10 bg-black/20 py-2 pl-9 pr-9 text-sm text-white placeholder:text-white/30 focus:border-[#98E32F]/50 focus:outline-none disabled:opacity-60"
          />
          {searching ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#98E32F]" />
          ) : (
            <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
          )}
          {hits.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-white/10 bg-[#013644] shadow-xl">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      applyPoint(hit, hit, true);
                      setQuery(hit.label);
                      setHits([]);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-white/90 hover:bg-[#98E32F]/10"
                  >
                    {hit.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {token ? (
        <div className="relative h-64 overflow-hidden rounded-lg border border-white/10">
          <Map
            ref={mapRef}
            mapLib={mapboxMapLib}
            mapboxAccessToken={token}
            initialViewState={{
              longitude: hasPin ? lng! : WAYANAD.longitude,
              latitude: hasPin ? lat! : WAYANAD.latitude,
              zoom: hasPin ? 15 : WAYANAD.zoom,
            }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              cursor: disabled ? "default" : "crosshair",
            }}
            onClick={(e) => {
              if (disabled) return;
              applyPoint({ lat: e.lngLat.lat, lng: e.lngLat.lng });
            }}
          >
            <NavigationControl position="top-right" />
            {hasPin ? (
              <Marker
                longitude={lng!}
                latitude={lat!}
                draggable={!disabled}
                onDragEnd={(e) => {
                  applyPoint({ lat: e.lngLat.lat, lng: e.lngLat.lng });
                }}
              >
                <span
                  title={name}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#98E32F] text-[#013644] shadow-lg"
                >
                  <Store className="h-4 w-4" />
                </span>
              </Marker>
            ) : null}
          </Map>
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/15 px-4 text-center text-sm text-white/40">
          Map preview needs a Mapbox token. Enter latitude and longitude below.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Latitude
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={latInput}
            disabled={disabled}
            onChange={(e) => setLatInput(e.target.value)}
            onBlur={commitManualCoords}
            placeholder="11.685000"
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm text-white focus:border-[#98E32F]/50 focus:outline-none disabled:opacity-60"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Longitude
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={lngInput}
            disabled={disabled}
            onChange={(e) => setLngInput(e.target.value)}
            onBlur={commitManualCoords}
            placeholder="76.132000"
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm text-white focus:border-[#98E32F]/50 focus:outline-none disabled:opacity-60"
          />
        </label>
      </div>
      <p className="text-[11px] text-white/35">
        Search, click the map, or drag the pin to set the restaurant entrance.
        This pin is used for delivery partner assignment.
      </p>
    </div>
  );
}
