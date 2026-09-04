"use client";

import mapboxgl from "mapbox-gl";

type MapboxGl = typeof mapboxgl;
type MaybeWrapped = MapboxGl & { default?: MapboxGl };

/**
 * Webpack / Next can wrap the mapbox-gl UMD bundle so `import('mapbox-gl')`
 * does not expose `.Map` on the namespace. react-map-gl then logs
 * "Invalid mapLib" and renders an empty container with no controls.
 */
function resolveMapboxGl(mod: MaybeWrapped): MapboxGl {
  if (typeof mod?.Map === "function") return mod;
  if (typeof mod?.default?.Map === "function") return mod.default;
  throw new Error("mapbox-gl failed to load (Map constructor missing)");
}

export const mapboxMapLib = resolveMapboxGl(mapboxgl as MaybeWrapped);

export default mapboxMapLib;
