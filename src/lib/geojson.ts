import type { ZoneGeometry } from "@/types/models";

/** Parse pasted GeoJSON into a Polygon or MultiPolygon for zone storage. */
export function parseZoneGeometryFromText(text: string): ZoneGeometry | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  return extractZoneGeometry(parsed);
}

export function extractZoneGeometry(raw: unknown): ZoneGeometry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.type === "Polygon" || o.type === "MultiPolygon") {
    return o as unknown as ZoneGeometry;
  }
  if (o.type === "Feature" && o.geometry && typeof o.geometry === "object") {
    const g = o.geometry as Record<string, unknown>;
    if (g.type === "Polygon" || g.type === "MultiPolygon") {
      return g as unknown as ZoneGeometry;
    }
  }
  if (o.type === "FeatureCollection" && Array.isArray(o.features)) {
    for (const f of o.features) {
      const inner = extractZoneGeometry(f);
      if (inner) return inner;
    }
  }
  return null;
}

export function isPolygon(
  g: ZoneGeometry | null,
): g is ZoneGeometry & { type: "Polygon" } {
  return g?.type === "Polygon";
}
