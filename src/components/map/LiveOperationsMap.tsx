"use client";

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import MapGL, {
  Marker,
  NavigationControl,
  Popup,
  type MapRef,
} from "react-map-gl/mapbox";
import Image from "next/image";
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
  const [mapError, setMapError] = useState<string | null>(null);
  const hasFittedRef = useRef(false);

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
        onLoad={handleMapLoad}
        onError={handleMapError}
        onClick={clearSelection}
        dragRotate={false}
        pitchWithRotate={false}
        attributionControl={false}
        fadeDuration={0}
        renderWorldCopies={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {showRestaurants
          ? restaurants.map((restaurant) => (
              <Marker
                key={`restaurant-${restaurant.id}`}
                longitude={restaurant.lng}
                latitude={restaurant.lat}
                anchor="center"
                onClick={(event) => {
                  event.originalEvent.stopPropagation();
                  startTransition(() =>
                    setSelected({ kind: "restaurant", data: restaurant }),
                  );
                }}
              >
                <PhotoMarker
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  fallback={restaurant.name.charAt(0)}
                  borderClassName={
                    restaurant.isOpen ? "border-[#98E32F]" : "border-red-500"
                  }
                />
              </Marker>
            ))
          : null}

        {showPartners
          ? partners.map((partner) => (
              <Marker
                key={`partner-${partner.id}`}
                longitude={partner.lng}
                latitude={partner.lat}
                anchor="center"
                onClick={(event) => {
                  event.originalEvent.stopPropagation();
                  startTransition(() =>
                    setSelected({ kind: "partner", data: partner }),
                  );
                }}
              >
                <PhotoMarker
                  src={partner.profilePhotoUrl}
                  alt={partner.fullName}
                  fallback={partner.fullName.charAt(0)}
                  borderClassName={
                    partner.onDuty ? "border-sky-400" : "border-[#98E32F]"
                  }
                />
              </Marker>
            ))
          : null}

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

function PhotoMarker({
  src,
  alt,
  fallback,
  borderClassName,
}: {
  src?: string | null;
  alt: string;
  fallback: string;
  borderClassName: string;
}) {
  return (
    <div
      title={alt}
      className={`relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border-[3px] bg-[#013644] text-sm font-bold uppercase text-white shadow-lg ${borderClassName}`}
    >
      <span>{fallback || "?"}</span>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="40px"
          unoptimized
          className="object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
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
