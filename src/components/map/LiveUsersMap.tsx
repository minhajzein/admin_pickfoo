"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapGL, {
  Layer,
  NavigationControl,
  Popup,
  Source,
  type MapMouseEvent,
  type MapRef,
} from "react-map-gl/mapbox";
import { mapboxMapLib } from "@/lib/mapbox";
import type { LiveAppUser } from "@/lib/api/analytics";

const WAYANAD_VIEW = { longitude: 76.132, latitude: 11.685, zoom: 10 };
const LAYER_ID = "live-users";

export type LiveUsersMapProps = {
  accessToken: string;
  users: LiveAppUser[];
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

function LiveUsersMap({ accessToken, users }: LiveUsersMapProps) {
  const mapRef = useRef<MapRef>(null);
  const hasFittedRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapped = useMemo(
    () => users.filter((u) => u.lat != null && u.lng != null),
    [users],
  );
  const selected = useMemo(
    () => mapped.find((u) => u.id === selectedId) ?? null,
    [mapped, selectedId],
  );

  const geojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: mapped.map((u) => ({
        type: "Feature" as const,
        properties: {
          id: u.id,
          guest: u.isGuest ? 1 : 0,
          device: u.locationSource === "device" ? 1 : 0,
        },
        geometry: { type: "Point" as const, coordinates: [u.lng!, u.lat!] },
      })),
    }),
    [mapped],
  );

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || hasFittedRef.current || !mapped.length) return;
    let minLng = mapped[0].lng!;
    let maxLng = minLng;
    let minLat = mapped[0].lat!;
    let maxLat = minLat;
    for (const u of mapped) {
      minLng = Math.min(minLng, u.lng!);
      maxLng = Math.max(maxLng, u.lng!);
      minLat = Math.min(minLat, u.lat!);
      maxLat = Math.max(maxLat, u.lat!);
    }
    requestAnimationFrame(() => {
      const live = mapRef.current?.getMap();
      if (!live || hasFittedRef.current) return;
      if (minLng === maxLng && minLat === maxLat) {
        live.flyTo({ center: [minLng, minLat], zoom: 13, duration: 600 });
      } else {
        live.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding: 72, maxZoom: 13, duration: 600 },
        );
      }
      hasFittedRef.current = true;
    });
  }, [mapped]);

  const handleClick = useCallback((event: MapMouseEvent) => {
    const feature = event.features?.[0];
    const id = feature?.properties?.id;
    setSelectedId(typeof id === "string" ? id : null);
  }, []);

  const handleMapError = useCallback((event: { error?: { message?: string } }) => {
    const message = event.error?.message || "";
    if (/token|unauthorized|forbidden|invalid maplib|failed to initialize/i.test(message)) {
      setMapError(message);
    }
  }, []);

  return (
    <div className="relative h-[min(64vh,680px)] min-h-96 overflow-hidden rounded-xl border border-white/10">
      {mapError ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center text-sm text-amber-200">
          Map failed to load. {mapError}
        </div>
      ) : null}
      <MapGL
        ref={mapRef}
        mapLib={mapboxMapLib}
        mapboxAccessToken={accessToken}
        initialViewState={WAYANAD_VIEW}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        interactiveLayerIds={[LAYER_ID]}
        onClick={handleClick}
        onLoad={() => mapRef.current?.resize()}
        onError={handleMapError}
        dragRotate={false}
        pitchWithRotate={false}
        attributionControl={false}
        renderWorldCopies={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Source id="live-users-src" type="geojson" data={geojson}>
          <Layer
            id={LAYER_ID}
            type="circle"
            paint={{
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 14, 9],
              "circle-color": ["case", ["==", ["get", "guest"], 1], "#94a3b8", "#98E32F"],
              "circle-opacity": 0.9,
              "circle-stroke-width": ["case", ["==", ["get", "device"], 1], 2.5, 1],
              "circle-stroke-color": [
                "case",
                ["==", ["get", "device"], 1],
                "#0ea5e9",
                "#013644",
              ],
            }}
          />
        </Source>

        {selected ? (
          <Popup
            longitude={selected.lng!}
            latitude={selected.lat!}
            closeOnClick={false}
            onClose={() => setSelectedId(null)}
            anchor="top"
            offset={12}
            maxWidth="280px"
          >
            <div className="min-w-55 max-w-70 space-y-1 text-sm text-[#013644]">
              <p className="font-semibold">{selected.name}</p>
              {selected.phone ? (
                <p className="text-xs text-[#013644]/70">{selected.phone}</p>
              ) : null}
              <div className="space-y-1 text-xs text-[#013644]/85">
                <p>
                  {selected.locationSource === "device"
                    ? "Device GPS location"
                    : "Delivery / browse location"}
                  {selected.locationLabel ? ` · ${selected.locationLabel}` : ""}
                </p>
                <p>
                  {selected.platform || "unknown"}
                  {selected.appVersion ? ` · v${selected.appVersion}` : ""}
                </p>
                <p>Last active {timeAgo(selected.lastSeenAt)}</p>
                <p>In app since {timeAgo(selected.sessionStartedAt)}</p>
              </div>
            </div>
          </Popup>
        ) : null}
      </MapGL>
    </div>
  );
}

export default memo(LiveUsersMap);
