"use client";

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import MapGL, {
  Layer,
  NavigationControl,
  Popup,
  Source,
  type MapRef,
} from "react-map-gl/mapbox";
import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  MapLayerMouseEvent,
} from "mapbox-gl";
import { mapboxMapLib } from "@/lib/mapbox";
import type {
  LiveMapPartnerMarker,
  LiveMapRestaurantMarker,
} from "@/lib/api/map";

const WAYANAD_VIEW = {
  longitude: 76.132,
  latitude: 11.685,
  zoom: 10,
};

const RESTAURANT_LAYER_ID = "live-restaurants-circle";
const PARTNER_LAYER_ID = "live-partners-circle";
const INTERACTIVE_LAYER_IDS = [RESTAURANT_LAYER_ID, PARTNER_LAYER_ID];

type SelectedMarker =
  | { kind: "partner"; data: LiveMapPartnerMarker }
  | { kind: "restaurant"; data: LiveMapRestaurantMarker };

export type LiveOperationsMapProps = {
  accessToken: string;
  partners: LiveMapPartnerMarker[];
  restaurants: LiveMapRestaurantMarker[];
  showPartners: boolean;
  showRestaurants: boolean;
};

function LiveOperationsMap({
  accessToken,
  partners,
  restaurants,
  showPartners,
  showRestaurants,
}: LiveOperationsMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [selected, setSelected] = useState<SelectedMarker | null>(null);
  const [cursor, setCursor] = useState<"grab" | "pointer">("grab");
  const [mapError, setMapError] = useState<string | null>(null);
  const hasFittedRef = useRef(false);

  const partnersById = useMemo(() => {
    const map = new globalThis.Map<string, LiveMapPartnerMarker>();
    for (const partner of partners) map.set(partner.id, partner);
    return map;
  }, [partners]);

  const restaurantsById = useMemo(() => {
    const map = new globalThis.Map<string, LiveMapRestaurantMarker>();
    for (const restaurant of restaurants) map.set(restaurant.id, restaurant);
    return map;
  }, [restaurants]);

  const partnersByIdRef = useRef(partnersById);
  const restaurantsByIdRef = useRef(restaurantsById);
  partnersByIdRef.current = partnersById;
  restaurantsByIdRef.current = restaurantsById;
  const restaurantGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: showRestaurants
        ? restaurants.map((restaurant) => ({
            type: "Feature" as const,
            id: restaurant.id,
            properties: {
              id: restaurant.id,
              kind: "restaurant",
              name: restaurant.name,
              isOpen: restaurant.isOpen ? 1 : 0,
            },
            geometry: {
              type: "Point" as const,
              coordinates: [restaurant.lng, restaurant.lat],
            },
          }))
        : [],
    }),
    [restaurants, showRestaurants],
  );

  const partnerGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: showPartners
        ? partners.map((partner) => ({
            type: "Feature" as const,
            id: partner.id,
            properties: {
              id: partner.id,
              kind: "partner",
              name: partner.fullName,
              onDuty: partner.onDuty ? 1 : 0,
            },
            geometry: {
              type: "Point" as const,
              coordinates: [partner.lng, partner.lat],
            },
          }))
        : [],
    }),
    [partners, showPartners],
  );

  const restaurantCirclePaint = useMemo(
    () =>
      ({
        "circle-radius": 9,
        "circle-color": [
          "case",
          ["==", ["get", "isOpen"], 1],
          "#98E32F",
          "#ef4444",
        ] as ExpressionSpecification,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      }) satisfies CircleLayerSpecification["paint"],
    [],
  );

  const partnerCirclePaint = useMemo(
    () =>
      ({
        "circle-radius": 8,
        "circle-color": [
          "case",
          ["==", ["get", "onDuty"], 1],
          "#38bdf8",
          "#98E32F",
        ] as ExpressionSpecification,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#002833",
      }) satisfies CircleLayerSpecification["paint"],
    [],
  );

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || hasFittedRef.current) return;

    const points = [
      ...restaurants.map((row) => [row.lng, row.lat] as [number, number]),
      ...partners.map((row) => [row.lng, row.lat] as [number, number]),
    ];
    if (!points.length) return;

    let minLng = points[0][0];
    let maxLng = points[0][0];
    let minLat = points[0][1];
    let maxLat = points[0][1];
    for (const [lng, lat] of points) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }

    // Fit after the current interaction frame so map event handlers stay light.
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
  }, [partners, restaurants]);

  const clearSelection = useCallback(() => {
    startTransition(() => setSelected(null));
  }, []);

  const handleMapClick = useCallback((event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) {
      startTransition(() => setSelected(null));
      return;
    }

    const id = String(feature.properties?.id ?? "");
    const kind = String(feature.properties?.kind ?? "");

    // Defer React popup work off the map event critical path (INP).
    startTransition(() => {
      if (kind === "partner") {
        const partner = partnersByIdRef.current.get(id);
        if (partner) setSelected({ kind: "partner", data: partner });
        return;
      }
      if (kind === "restaurant") {
        const restaurant = restaurantsByIdRef.current.get(id);
        if (restaurant) setSelected({ kind: "restaurant", data: restaurant });
      }
    });
  }, []);

  const handleMouseEnter = useCallback(() => setCursor("pointer"), []);
  const handleMouseLeave = useCallback(() => setCursor("grab"), []);
  const handleMapLoad = useCallback(() => {
    mapRef.current?.resize();
  }, []);
  const handleMapError = useCallback((event: { target: unknown; error?: { message?: string } }) => {
    if (event.target) return;
    setMapError(event.error?.message || "Map failed to initialize");
  }, []);

  return (
    <div className="relative h-[min(72vh,760px)] min-h-[420px] overflow-hidden rounded-xl border border-white/10">
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
        interactiveLayerIds={INTERACTIVE_LAYER_IDS}
        cursor={cursor}
        onLoad={handleMapLoad}
        onError={handleMapError}
        onClick={handleMapClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        dragRotate={false}
        pitchWithRotate={false}
        attributionControl={false}
        fadeDuration={0}
        renderWorldCopies={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        <Source id="live-restaurants" type="geojson" data={restaurantGeoJson}>
          <Layer
            id={RESTAURANT_LAYER_ID}
            type="circle"
            paint={restaurantCirclePaint}
          />
        </Source>

        <Source id="live-partners" type="geojson" data={partnerGeoJson}>
          <Layer
            id={PARTNER_LAYER_ID}
            type="circle"
            paint={partnerCirclePaint}
          />
        </Source>

        {selected ? (
          <Popup
            longitude={selected.data.lng}
            latitude={selected.data.lat}
            closeOnClick={false}
            onClose={clearSelection}
            anchor="top"
            offset={16}
            maxWidth="280px"
          >
            {selected.kind === "partner" ? (
              <PartnerPopup partner={selected.data} />
            ) : (
              <RestaurantPopup restaurant={selected.data} />
            )}
          </Popup>
        ) : null}
      </MapGL>
    </div>
  );
}

function PartnerPopup({ partner }: { partner: LiveMapPartnerMarker }) {
  return (
    <PopupCard title={partner.fullName} subtitle={partner.phone}>
      <p>
        {partner.onDuty
          ? "On delivery"
          : partner.isOnline
            ? "Online"
            : "Offline"}
      </p>
      <p>Priority level {partner.priorityLevel}</p>
      {partner.zones.length ? (
        <p>Zones: {partner.zones.map((zone) => zone.name).join(", ")}</p>
      ) : (
        <p>No service zones assigned</p>
      )}
    </PopupCard>
  );
}

function RestaurantPopup({
  restaurant,
}: {
  restaurant: LiveMapRestaurantMarker;
}) {
  return (
    <PopupCard title={restaurant.name} subtitle={restaurant.status}>
      <p
        className={
          restaurant.isOpen
            ? "font-medium text-emerald-600"
            : "font-medium text-red-600"
        }
      >
        {restaurant.isOpen ? "Open now" : "Closed right now"}
      </p>
      {restaurant.zone ? (
        <p>Zone: {restaurant.zone.name}</p>
      ) : (
        <p>No zone assigned</p>
      )}
    </PopupCard>
  );
}

function PopupCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-[220px] max-w-[280px] space-y-1 text-sm text-[#013644]">
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-[#013644]/70">{subtitle}</p>
      <div className="space-y-1 text-xs text-[#013644]/85">{children}</div>
    </div>
  );
}

export default memo(LiveOperationsMap);
