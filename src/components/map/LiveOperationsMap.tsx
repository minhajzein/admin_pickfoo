"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Map, {
  Layer,
  NavigationControl,
  Popup,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/mapbox";
import type { FeatureCollection, Point } from "geojson";
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

const EMPTY_FC: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: [],
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

  const restaurantFc = useMemo<FeatureCollection<Point>>(() => {
    if (!showRestaurants) return EMPTY_FC;
    return {
      type: "FeatureCollection",
      features: restaurants.map((restaurant) => ({
        type: "Feature",
        id: restaurant.id,
        properties: {
          kind: "restaurant",
          name: restaurant.name,
          isOpen: restaurant.isOpen,
          status: restaurant.status,
        },
        geometry: {
          type: "Point",
          coordinates: [restaurant.lng, restaurant.lat],
        },
      })),
    };
  }, [restaurants, showRestaurants]);

  const partnerFc = useMemo<FeatureCollection<Point>>(() => {
    if (!showPartners) return EMPTY_FC;
    return {
      type: "FeatureCollection",
      features: partners.map((partner) => ({
        type: "Feature",
        id: partner.id,
        properties: {
          kind: "partner",
          fullName: partner.fullName,
          onDuty: partner.onDuty,
          isOnline: partner.isOnline,
        },
        geometry: {
          type: "Point",
          coordinates: [partner.lng, partner.lat],
        },
      })),
    };
  }, [partners, showPartners]);

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

  const handleMapClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const layers = [
        showRestaurants ? "live-restaurants-circle" : null,
        showPartners ? "live-partners-circle" : null,
      ].filter(Boolean) as string[];

      if (!layers.length) {
        setSelected(null);
        return;
      }

      const hits = map.queryRenderedFeatures(event.point, { layers });
      const top = hits[0];
      if (!top?.properties?.kind || !top.geometry || top.geometry.type !== "Point") {
        setSelected(null);
        return;
      }

      const [lng, lat] = top.geometry.coordinates;
      if (top.properties.kind === "partner") {
        const partner = partners.find((row) => row.id === String(top.id));
        if (partner) {
          setSelected({ kind: "partner", data: { ...partner, lng, lat } });
          return;
        }
      }
      if (top.properties.kind === "restaurant") {
        const restaurant = restaurants.find((row) => row.id === String(top.id));
        if (restaurant) {
          setSelected({ kind: "restaurant", data: { ...restaurant, lng, lat } });
          return;
        }
      }
      setSelected(null);
    },
    [partners, restaurants, showPartners, showRestaurants],
  );

  return (
    <div className="relative h-[min(72vh,760px)] min-h-[420px] overflow-hidden rounded-xl border border-white/10">
      <Map
        ref={mapRef}
        mapboxAccessToken={accessToken}
        initialViewState={WAYANAD_VIEW}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        onClick={handleMapClick}
        interactiveLayerIds={[
          ...(showRestaurants ? ["live-restaurants-circle"] : []),
          ...(showPartners ? ["live-partners-circle"] : []),
        ]}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {showRestaurants ? (
          <Source id="live-restaurants" type="geojson" data={restaurantFc}>
            <Layer
              id="live-restaurants-circle"
              type="circle"
              paint={{
                "circle-radius": 8,
                "circle-color": "#f59e0b",
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
              }}
            />
          </Source>
        ) : null}

        {showPartners ? (
          <Source id="live-partners" type="geojson" data={partnerFc}>
            <Layer
              id="live-partners-circle"
              type="circle"
              paint={{
                "circle-radius": [
                  "case",
                  ["boolean", ["get", "onDuty"], false],
                  11,
                  9,
                ],
                "circle-color": [
                  "case",
                  ["boolean", ["get", "onDuty"], false],
                  "#38bdf8",
                  "#98E32F",
                ],
                "circle-stroke-color": "#002833",
                "circle-stroke-width": 2,
              }}
            />
          </Source>
        ) : null}

        {selected ? (
          <Popup
            longitude={selected.data.lng}
            latitude={selected.data.lat}
            closeOnClick={false}
            onClose={() => setSelected(null)}
            anchor="bottom"
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
