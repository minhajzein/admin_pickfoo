"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Map, {
  Marker,
  NavigationControl,
  Popup,
  type MapRef,
} from "react-map-gl/mapbox";
import { Bike, Store } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";
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

export default function LiveOperationsMap({
  accessToken,
  partners,
  restaurants,
  showPartners,
  showRestaurants,
}: LiveOperationsMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [selected, setSelected] = useState<SelectedMarker | null>(null);
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

    if (minLng === maxLng && minLat === maxLat) {
      map.flyTo({ center: [minLng, minLat], zoom: 13, duration: 800 });
    } else {
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 72, maxZoom: 13, duration: 800 },
      );
    }
    hasFittedRef.current = true;
  }, [partners, restaurants]);

  return (
    <div className="relative h-[min(72vh,760px)] min-h-[420px] overflow-hidden rounded-xl border border-white/10">
      <Map
        ref={mapRef}
        mapboxAccessToken={accessToken}
        initialViewState={WAYANAD_VIEW}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        onClick={() => setSelected(null)}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {showRestaurants
          ? restaurants.map((restaurant) => (
              <Marker
                key={`restaurant-${restaurant.id}`}
                longitude={restaurant.lng}
                latitude={restaurant.lat}
                anchor="bottom"
              >
                <MapMarkerButton
                  label={restaurant.name}
                  onClick={() =>
                    setSelected({ kind: "restaurant", data: restaurant })
                  }
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-white shadow-lg">
                    <Store className="h-4 w-4" />
                  </span>
                </MapMarkerButton>
              </Marker>
            ))
          : null}

        {showPartners
          ? partners.map((partner) => (
              <Marker
                key={`partner-${partner.id}`}
                longitude={partner.lng}
                latitude={partner.lat}
                anchor="bottom"
              >
                <MapMarkerButton
                  label={partner.fullName}
                  onClick={() => setSelected({ kind: "partner", data: partner })}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#002833] text-[#002833] shadow-lg ${
                      partner.onDuty ? "bg-sky-300" : "bg-[#98E32F]"
                    }`}
                  >
                    <Bike className="h-4 w-4" />
                  </span>
                </MapMarkerButton>
              </Marker>
            ))
          : null}

        {selected ? (
          <Popup
            longitude={selected.data.lng}
            latitude={selected.data.lat}
            closeOnClick={false}
            onClose={() => setSelected(null)}
            anchor="top"
            offset={16}
          >
            {selected.kind === "partner" ? (
              <PartnerPopup partner={selected.data} />
            ) : (
              <RestaurantPopup restaurant={selected.data} />
            )}
          </Popup>
        ) : null}
      </Map>
    </div>
  );
}

function MapMarkerButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="group flex -translate-x-1/2 flex-col items-center gap-1 border-0 bg-transparent p-0"
    >
      {children}
      <span className="max-w-[160px] truncate rounded-md bg-[#002833]/95 px-2 py-0.5 text-[11px] font-medium text-white shadow-md ring-1 ring-white/10">
        {label}
      </span>
    </button>
  );
}

function PartnerPopup({ partner }: { partner: LiveMapPartnerMarker }) {
  return (
    <PopupCard title={partner.fullName} subtitle={partner.phone}>
      <p>
        {partner.onDuty ? "On delivery" : partner.isOnline ? "Online" : "Offline"}
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

function RestaurantPopup({ restaurant }: { restaurant: LiveMapRestaurantMarker }) {
  return (
    <PopupCard title={restaurant.name} subtitle={restaurant.status}>
      <p>{restaurant.isOpen ? "Open now" : "Closed right now"}</p>
      {restaurant.zone ? <p>Zone: {restaurant.zone.name}</p> : <p>No zone assigned</p>}
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
