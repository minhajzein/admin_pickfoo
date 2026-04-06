"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
  Layer,
  NavigationControl,
  Source,
  type MapRef,
} from "react-map-gl/mapbox";
import mapboxgl, {
  type Map as MapboxMap,
  type MapLayerMouseEvent,
} from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
} from "geojson";
import type { PolygonZoneGeometry, ZoneGeometry } from "@/types/models";
import { HelpCircle, Layers, X } from "lucide-react";

const WAYANAD_VIEW = {
  longitude: 76.132,
  latitude: 11.685,
  zoom: 10,
};

const EMPTY_FC: FeatureCollection<Geometry> = {
  type: "FeatureCollection",
  features: [],
};

/** Admin UI theme — high contrast on Mapbox Streets basemap */
const THEME = {
  lime: "#98E32F",
  limeMuted: "#7ec41f",
  limeSoft: "#b8f04a",
  teal: "#002833",
  tealMid: "#0d5c6b",
} as const;

export type SubdivisionPickMeta = {
  label: string;
  key?: string;
};

export type ZoneMapEditorProps = {
  accessToken: string;
  /** Editable polygon in Mapbox Draw (single Polygon). */
  drawPolygon: PolygonZoneGeometry | null;
  onDrawPolygonChange: (polygon: PolygonZoneGeometry | null) => void;
  /** Non-editable outline (e.g. MultiPolygon), shown as fill + line. */
  readOnlyGeometry: ZoneGeometry | null;
  /** Called when admin picks a police subdivision polygon as the zone boundary. */
  onSubdivisionGeometryPick?: (
    geometry: PolygonZoneGeometry,
    meta: SubdivisionPickMeta,
  ) => void;
};

export default function ZoneMapEditor({
  accessToken,
  drawPolygon,
  onDrawPolygonChange,
  readOnlyGeometry,
  onSubdivisionGeometryPick,
}: ZoneMapEditorProps) {
  const mapRef = useRef<MapRef>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const drawSerializedRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  /** Default closed so the map uses full height; open from “Drawing tips” if needed. */
  const [hintsOpen, setHintsOpen] = useState(false);
  const [adminDistrictFc, setAdminDistrictFc] =
    useState<FeatureCollection<Geometry> | null>(null);
  const [adminMunicipalityFc, setAdminMunicipalityFc] =
    useState<FeatureCollection<Geometry> | null>(null);
  const [adminCorporationFc, setAdminCorporationFc] =
    useState<FeatureCollection<Geometry> | null>(null);
  const [showDistrictBoundary, setShowDistrictBoundary] = useState(true);
  const [showMunicipalityBoundary, setShowMunicipalityBoundary] =
    useState(true);
  const [showCorporationBoundary, setShowCorporationBoundary] =
    useState(true);
  const [adminSubdivisionFc, setAdminSubdivisionFc] =
    useState<FeatureCollection<Geometry> | null>(null);
  const [adminSubdivisionLabelsFc, setAdminSubdivisionLabelsFc] =
    useState<FeatureCollection<Geometry> | null>(null);
  const [showSubdivisionBoundary, setShowSubdivisionBoundary] =
    useState(true);
  const [adminBoundariesPanelOpen, setAdminBoundariesPanelOpen] =
    useState(true);
  const [subdivisionPickMode, setSubdivisionPickMode] = useState(false);
  const onDrawPolygonChangeRef = useRef(onDrawPolygonChange);
  const onSubdivisionGeometryPickRef = useRef(onSubdivisionGeometryPick);
  useEffect(() => {
    onDrawPolygonChangeRef.current = onDrawPolygonChange;
  }, [onDrawPolygonChange]);
  useEffect(() => {
    onSubdivisionGeometryPickRef.current = onSubdivisionGeometryPick;
  }, [onSubdivisionGeometryPick]);

  useEffect(() => {
    let cancelled = false;
    const load = async (path: string) => {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`${path}: ${res.status}`);
      return (await res.json()) as FeatureCollection<Geometry>;
    };
    void Promise.all([
      load("/geo/wayanad-district.geojson"),
      load("/geo/wayanad-municipalities.geojson"),
      load("/geo/wayanad-corporations.geojson"),
      load("/geo/wayanad-police-subdivisions.geojson"),
      load("/geo/wayanad-police-subdivision-labels.geojson"),
    ])
      .then(([d, m, c, sub, subLbl]) => {
        if (cancelled) return;
        setAdminDistrictFc(d);
        setAdminMunicipalityFc(m);
        setAdminCorporationFc(c);
        setAdminSubdivisionFc(sub);
        setAdminSubdivisionLabelsFc(subLbl);
      })
      .catch(() => {
        if (!cancelled) {
          setAdminDistrictFc(EMPTY_FC);
          setAdminMunicipalityFc(EMPTY_FC);
          setAdminCorporationFc(EMPTY_FC);
          setAdminSubdivisionFc(EMPTY_FC);
          setAdminSubdivisionLabelsFc(EMPTY_FC);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const emitDraw = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    const fc = draw.getAll();
    const feat = fc.features.find((f) => f.geometry?.type === "Polygon");
    const g = feat?.geometry;
    if (g && g.type === "Polygon") {
      onDrawPolygonChangeRef.current(g as PolygonZoneGeometry);
    } else {
      onDrawPolygonChangeRef.current(null);
    }
  }, []);

  const handleLoad = useCallback(
    (e: { target: MapboxMap }) => {
      const map = e.target;
      map.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "bottom-right",
      );
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true,
        },
      });
      map.addControl(draw, "top-left");
      drawRef.current = draw;

      map.on("draw.create", emitDraw);
      map.on("draw.update", emitDraw);
      map.on("draw.delete", emitDraw);

      setMapReady(true);
    },
    [emitDraw],
  );

  useEffect(() => {
    if (!mapReady || subdivisionPickMode) return;
    const draw = drawRef.current;
    if (!draw) return;
    const serialized = drawPolygon ? JSON.stringify(drawPolygon) : "__empty__";
    if (drawSerializedRef.current === serialized) return;
    drawSerializedRef.current = serialized;
    draw.deleteAll();
    if (drawPolygon) {
      draw.add({
        type: "Feature",
        properties: {},
        geometry: drawPolygon,
      });
      draw.changeMode("simple_select");
    } else {
      draw.changeMode("draw_polygon");
    }
  }, [drawPolygon, mapReady, subdivisionPickMode]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const resize = () => map.resize();
    resize();
    const raf = requestAnimationFrame(resize);
    const t = window.setTimeout(resize, 100);
    const t2 = window.setTimeout(resize, 400);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [mapReady]);

  /** Subdivision lines were drawn under basemap land/road layers; move to stack top. */
  useEffect(() => {
    if (!mapReady || !adminSubdivisionFc) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const bringToFront = () => {
      try {
        if (map.getLayer("admin-subdivision-fill")) {
          map.moveLayer("admin-subdivision-fill");
        }
        if (map.getLayer("admin-subdivision-casing")) {
          map.moveLayer("admin-subdivision-casing");
        }
        if (map.getLayer("admin-subdivision-line")) {
          map.moveLayer("admin-subdivision-line");
        }
        if (map.getLayer("admin-subdivision-symbol")) {
          map.moveLayer("admin-subdivision-symbol");
        }
      } catch {
        /* style not ready or layer ids missing */
      }
    };

    bringToFront();
    const t = window.setTimeout(bringToFront, 50);
    const t2 = window.setTimeout(bringToFront, 300);
    map.once("idle", bringToFront);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [mapReady, adminSubdivisionFc, adminSubdivisionLabelsFc]);

  useEffect(() => {
    if (!mapReady) return;
    const draw = drawRef.current;
    if (!draw) return;
    if (subdivisionPickMode) {
      draw.changeMode("simple_select");
    }
  }, [mapReady, subdivisionPickMode]);

  useEffect(() => {
    if (
      !mapReady ||
      !subdivisionPickMode ||
      !showSubdivisionBoundary ||
      !onSubdivisionGeometryPick
    ) {
      return;
    }
    const map = mapRef.current?.getMap();
    if (!map) return;

    const handler = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f?.geometry || f.geometry.type !== "Polygon") return;
      const coords = JSON.parse(
        JSON.stringify(f.geometry.coordinates),
      ) as PolygonZoneGeometry["coordinates"];
      const props = f.properties as Record<string, unknown>;
      const label = String(props.subdivision_label ?? "Subdivision");
      const key =
        typeof props.subdivision_key === "string"
          ? props.subdivision_key
          : undefined;
      const geometry = {
        type: "Polygon" as const,
        coordinates: coords as number[][][],
      };
      onSubdivisionGeometryPickRef.current?.(
        geometry as PolygonZoneGeometry,
        { label, key },
      );
      setSubdivisionPickMode(false);
    };

    let attached = false;
    const tryAttach = () => {
      if (attached || !map.getLayer("admin-subdivision-fill")) return;
      map.on("click", "admin-subdivision-fill", handler);
      attached = true;
      map.getCanvas().style.cursor = "crosshair";
    };

    tryAttach();
    const t1 = window.setTimeout(tryAttach, 80);
    const t2 = window.setTimeout(tryAttach, 350);
    map.once("idle", tryAttach);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      map.off("idle", tryAttach);
      map.off("click", "admin-subdivision-fill", handler);
      map.getCanvas().style.cursor = "";
    };
  }, [
    mapReady,
    subdivisionPickMode,
    showSubdivisionBoundary,
    onSubdivisionGeometryPick,
    adminSubdivisionFc,
  ]);

  const overlayData: Feature<MultiPolygon> | null =
    readOnlyGeometry?.type === "MultiPolygon"
      ? {
          type: "Feature",
          properties: {},
          geometry: {
            type: "MultiPolygon",
            coordinates: readOnlyGeometry.coordinates as MultiPolygon["coordinates"],
          },
        }
      : null;

  return (
    <div className="relative h-full min-h-0 w-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={accessToken}
        initialViewState={WAYANAD_VIEW}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        attributionControl={false}
        onLoad={handleLoad}
      >
        <NavigationControl position="top-right" />
        {adminDistrictFc && (
          <Source id="admin-district" type="geojson" data={adminDistrictFc}>
            <Layer
              id="admin-district-casing"
              type="line"
              layout={{
                visibility: showDistrictBoundary ? "visible" : "none",
              }}
              paint={{
                "line-color": THEME.teal,
                "line-width": 5,
                "line-opacity": 0.55,
              }}
            />
            <Layer
              id="admin-district-line"
              type="line"
              layout={{
                visibility: showDistrictBoundary ? "visible" : "none",
              }}
              paint={{
                "line-color": THEME.lime,
                "line-width": 2.5,
                "line-opacity": 1,
              }}
            />
          </Source>
        )}
        {adminMunicipalityFc && (
          <Source
            id="admin-municipalities"
            type="geojson"
            data={adminMunicipalityFc}
          >
            <Layer
              id="admin-municipality-line"
              type="line"
              layout={{
                visibility: showMunicipalityBoundary ? "visible" : "none",
              }}
              paint={{
                "line-color": THEME.tealMid,
                "line-width": 2,
                "line-opacity": 1,
                "line-dasharray": [2, 2],
              }}
            />
          </Source>
        )}
        {adminCorporationFc && (
          <Source
            id="admin-corporations"
            type="geojson"
            data={adminCorporationFc}
          >
            <Layer
              id="admin-corporation-line"
              type="line"
              layout={{
                visibility: showCorporationBoundary ? "visible" : "none",
              }}
              paint={{
                "line-color": THEME.limeSoft,
                "line-width": 2.5,
                "line-opacity": 0.95,
              }}
            />
          </Source>
        )}
        {overlayData && (
          <Source id="zone-readonly-overlay" type="geojson" data={overlayData}>
            <Layer
              id="zone-readonly-fill"
              type="fill"
              paint={{
                "fill-color": "#98E32F",
                "fill-opacity": 0.2,
              }}
            />
            <Layer
              id="zone-readonly-line"
              type="line"
              paint={{
                "line-color": "#98E32F",
                "line-width": 2,
              }}
            />
          </Source>
        )}
        {adminSubdivisionFc && (
          <Source
            id="admin-subdivisions"
            type="geojson"
            data={adminSubdivisionFc}
          >
            <Layer
              id="admin-subdivision-fill"
              type="fill"
              layout={{
                visibility: showSubdivisionBoundary ? "visible" : "none",
              }}
              paint={{
                "fill-color": THEME.teal,
                "fill-opacity": subdivisionPickMode ? 0.08 : 0,
              }}
            />
            <Layer
              id="admin-subdivision-casing"
              type="line"
              layout={{
                visibility: showSubdivisionBoundary ? "visible" : "none",
              }}
              paint={{
                "line-color": THEME.teal,
                "line-width": 10,
                "line-opacity": 0.85,
              }}
            />
            <Layer
              id="admin-subdivision-line"
              type="line"
              layout={{
                visibility: showSubdivisionBoundary ? "visible" : "none",
              }}
              paint={{
                "line-color": THEME.lime,
                "line-width": 4,
                "line-opacity": 1,
                "line-dasharray": [2.5, 1.5],
              }}
            />
          </Source>
        )}
        {adminSubdivisionLabelsFc && (
          <Source
            id="admin-subdivision-labels"
            type="geojson"
            data={adminSubdivisionLabelsFc}
          >
            <Layer
              id="admin-subdivision-symbol"
              type="symbol"
              layout={{
                visibility: showSubdivisionBoundary ? "visible" : "none",
                "text-field": ["get", "subdivision_label"],
                "text-size": 13,
                "text-anchor": "center",
                "text-allow-overlap": true,
                "text-ignore-placement": true,
              }}
              paint={{
                "text-color": THEME.lime,
                "text-halo-color": THEME.teal,
                "text-halo-width": 3,
                "text-halo-blur": 0.5,
              }}
            />
          </Source>
        )}
      </Map>

      {adminBoundariesPanelOpen && (
      <div
        id="admin-boundaries-panel"
        className="pointer-events-auto absolute bottom-3 left-3 z-2 max-w-[min(100%,300px)] rounded-lg border border-white/10 bg-[#002833]/95 px-2.5 py-2 text-[10px] text-white/85 shadow-md backdrop-blur-sm sm:text-[11px]"
        role="region"
        aria-label="Admin boundary layer toggles"
      >
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <p className="font-semibold text-white/90">Admin boundaries</p>
          <button
            type="button"
            onClick={() => setAdminBoundariesPanelOpen(false)}
            className="-m-1 shrink-0 rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-controls="admin-boundaries-panel"
            aria-label="Hide admin boundaries panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showDistrictBoundary}
              onChange={(e) => setShowDistrictBoundary(e.target.checked)}
              className="accent-[#98E32F]"
            />
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 rounded-sm bg-[#98E32F]"
                aria-hidden
              />
              District
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={showSubdivisionBoundary}
              onChange={(e) => {
                setShowSubdivisionBoundary(e.target.checked);
                if (!e.target.checked) setSubdivisionPickMode(false);
              }}
              className="mt-0.5 accent-[#7ec41f]"
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-0.5 w-4 rounded-sm border border-dashed border-[#7ec41f] bg-[#002833]/80"
                  aria-hidden
                />
                Subdivisions
              </span>
              {onSubdivisionGeometryPick &&
                adminSubdivisionFc &&
                adminSubdivisionFc.features.length > 0 && (
                  <div className="pl-5 pt-1">
                    {subdivisionPickMode ? (
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-medium text-[#98E32F]/90 sm:text-[10px]">
                          Click inside Mananthavady, Kalpetta, or Sulthan Bathery
                          to set the zone boundary.
                        </p>
                        <button
                          type="button"
                          onClick={() => setSubdivisionPickMode(false)}
                          className="text-[9px] text-white/50 underline hover:text-white/80 sm:text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!showSubdivisionBoundary}
                        onClick={() => setSubdivisionPickMode(true)}
                        className="text-left text-[9px] font-medium text-[#98E32F]/90 underline decoration-[#98E32F]/40 underline-offset-2 hover:text-[#b8f04a] disabled:cursor-not-allowed disabled:opacity-40 sm:text-[10px]"
                      >
                        Use subdivision as zone…
                      </button>
                    )}
                  </div>
                )}
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showMunicipalityBoundary}
              onChange={(e) => setShowMunicipalityBoundary(e.target.checked)}
              className="accent-[#0d5c6b]"
            />
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 rounded-sm border border-dashed border-[#0d5c6b] bg-transparent"
                aria-hidden
              />
              Municipality
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showCorporationBoundary}
              onChange={(e) => setShowCorporationBoundary(e.target.checked)}
              className="accent-[#b8f04a]"
            />
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 rounded-sm bg-[#b8f04a]"
                aria-hidden
              />
              Corporation
            </span>
          </label>
        </div>
        <p className="mt-1.5 border-t border-white/10 pt-1.5 text-[9px] leading-snug text-white/45 sm:text-[10px]">
          <a
            href="https://github.com/opendatakerala/kl_district"
            className="text-[#98E32F]/80 underline hover:text-[#98E32F]"
            target="_blank"
            rel="noopener noreferrer"
          >
            District
          </a>
          {" · "}
          <a
            href="https://github.com/opendatakerala/lsg-kerala-data"
            className="text-[#98E32F]/80 underline hover:text-[#98E32F]"
            target="_blank"
            rel="noopener noreferrer"
          >
            LSG
          </a>{" "}
          (Open Data Kerala, ODbL). Subdivision outlines merge LSG units to
          match the published police jurisdiction grouping; they are not
          certified police geometry.
          {adminCorporationFc &&
            adminCorporationFc.features.length === 0 && (
              <span className="mt-0.5 block text-white/40">
                No corporation boundaries in this extract.
              </span>
            )}
        </p>
      </div>
      )}

      {!adminBoundariesPanelOpen && (
        <button
          type="button"
          onClick={() => setAdminBoundariesPanelOpen(true)}
          className="pointer-events-auto absolute bottom-3 left-3 z-2 flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#002833]/90 px-2 py-1.5 text-[11px] font-medium text-[#98E32F] shadow-md backdrop-blur-sm hover:bg-[#002833] hover:text-[#b8f04a]"
          aria-label="Show admin boundaries panel"
        >
          <Layers className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Boundaries</span>
        </button>
      )}

      {!hintsOpen && (
        <button
          type="button"
          onClick={() => setHintsOpen(true)}
          className="absolute top-3 right-14 z-2 flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#002833]/90 px-2 py-1 text-[11px] font-medium text-[#98E32F] shadow-md backdrop-blur-sm hover:bg-[#002833] hover:text-[#b8f04a] sm:right-16"
          aria-expanded={false}
          aria-controls="zone-draw-hints"
          aria-label="Show drawing tips"
        >
          <HelpCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Drawing tips</span>
        </button>
      )}

      {hintsOpen && (
        <div
          className="pointer-events-none absolute top-3 left-3 right-3 z-1 flex justify-center sm:left-12 sm:right-20"
          role="presentation"
        >
          <div
            id="zone-draw-hints"
            className="pointer-events-auto max-h-[40vh] max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#002833]/95 px-3 py-2.5 text-[11px] text-white/90 shadow-lg backdrop-blur-sm sm:px-4 sm:py-3 sm:text-xs"
            role="status"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="font-bold text-[#98E32F]">
                Draw the zone on the map
              </p>
              <button
                type="button"
                onClick={() => setHintsOpen(false)}
                className="-m-1 shrink-0 rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Hide drawing tips"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="list-decimal space-y-1 pl-4 text-white/75">
              <li>
                Use the{" "}
                <span className="font-semibold text-white/90">pentagon</span>{" "}
                tool (top-left) if it is not already active.
              </li>
              <li>
                Click each corner of the delivery area along roads or landmarks.
              </li>
              <li>
                <span className="font-semibold text-white/90">Double-click</span>{" "}
                the last point to finish the shape.
              </li>
              <li>
                Drag corners to adjust. Use the{" "}
                <span className="font-semibold text-white/90">trash</span> icon
                to start over.
              </li>
            </ol>
            {readOnlyGeometry?.type === "MultiPolygon" && (
              <p className="mt-2 border-t border-white/10 pt-2 text-amber-200/90">
                This zone uses a complex shape (MultiPolygon). Edit it under
                Advanced → GeoJSON, or redraw as a single area on the map.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
