"use client";

import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createZone,
  deleteZone,
  fetchZones,
  updateZone,
} from "@/lib/api/zones";
import { parseZoneGeometryFromText } from "@/lib/geojson";
import type { SubdivisionPickMeta } from "@/components/zones/ZoneMapEditor";
import type {
  DeliveryZone,
  PolygonZoneGeometry,
  ZoneGeometry,
} from "@/types/models";
import { Loader2, MapPin, Plus, Save, Trash2 } from "lucide-react";

const ZoneMapEditor = dynamic(
  () => import("@/components/zones/ZoneMapEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(58vh,560px)] min-h-[320px] items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/50">
        <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
      </div>
    ),
  },
);

const DEFAULT_ZONE_COLOR = "#98e32f";

/** `#rrggbb` for `<input type="color">` (6-digit only). */
function normalizePickerHex(raw: string | undefined | null): string {
  const t = (raw ?? "").trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(t)) return t.toLowerCase();
  if (/^#[0-9A-Fa-f]{8}$/i.test(t))
    return `#${t.slice(1, 7).toLowerCase()}`;
  return DEFAULT_ZONE_COLOR;
}

function geometryForSave(
  drawPolygon: PolygonZoneGeometry | null,
  override: ZoneGeometry | null,
  geoText: string,
): ZoneGeometry | null {
  if (override) return override;
  if (drawPolygon) return drawPolygon;
  return parseZoneGeometryFromText(geoText);
}

export default function ZonesPage() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
  const queryClient = useQueryClient();

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["zones", "admin"],
    queryFn: () =>
      fetchZones({ district: undefined, includeInactive: true }),
  });

  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [district, setDistrict] = useState("Wayanad");
  const [color, setColor] = useState(DEFAULT_ZONE_COLOR);
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [geoText, setGeoText] = useState("");
  const [drawPolygon, setDrawPolygon] = useState<PolygonZoneGeometry | null>(
    null,
  );
  const [geometryOverride, setGeometryOverride] =
    useState<ZoneGeometry | null>(null);

  const resetForm = useCallback(() => {
    setSelectedId(null);
    setName("");
    setCode("");
    setDistrict("Wayanad");
    setColor(DEFAULT_ZONE_COLOR);
    setSortOrder(0);
    setIsActive(true);
    setGeoText("");
    setDrawPolygon(null);
    setGeometryOverride(null);
  }, []);

  const loadZoneIntoForm = useCallback((z: DeliveryZone) => {
    setSelectedId(z._id);
    setName(z.name);
    setCode(z.code);
    setDistrict(z.district);
    setColor(normalizePickerHex(z.color));
    setSortOrder(z.sortOrder ?? 0);
    setIsActive(z.isActive !== false);
    setGeoText(JSON.stringify(z.geometry, null, 2));
    setGeometryOverride(null);
    if (z.geometry.type === "Polygon") {
      setDrawPolygon(z.geometry as PolygonZoneGeometry);
    } else {
      setDrawPolygon(null);
    }
  }, []);

  const openNewZoneDialog = useCallback(() => {
    resetForm();
    setSelectedId("new");
    setZoneDialogOpen(true);
  }, [resetForm]);

  const openEditZoneDialog = useCallback(
    (z: DeliveryZone) => {
      loadZoneIntoForm(z);
      setZoneDialogOpen(true);
    },
    [loadZoneIntoForm],
  );

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setZoneDialogOpen(open);
      if (!open) {
        resetForm();
      }
    },
    [resetForm],
  );

  const createMut = useMutation({
    mutationFn: createZone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zones"] });
      toast.success("Zone created");
      setZoneDialogOpen(false);
      resetForm();
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === "object" && "response" in e
          ? String(
              (e as { response?: { data?: { message?: string } } }).response
                ?.data?.message,
            )
          : "Failed to create zone";
      toast.error(msg || "Failed to create zone");
    },
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof updateZone>[1];
    }) => updateZone(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zones"] });
      toast.success("Zone updated");
    },
    onError: () => toast.error("Failed to update zone"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteZone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zones"] });
      toast.success("Zone deleted");
      setZoneDialogOpen(false);
      resetForm();
    },
    onError: () => toast.error("Failed to delete zone"),
  });

  const readOnlyGeometry: ZoneGeometry | null = useMemo(() => {
    if (geometryOverride?.type === "MultiPolygon") return geometryOverride;
    if (selectedId && selectedId !== "new") {
      const z = zones.find((x) => x._id === selectedId);
      if (z?.geometry.type === "MultiPolygon") return z.geometry;
    }
    return null;
  }, [geometryOverride, selectedId, zones]);

  const applyGeoJson = () => {
    const parsed = parseZoneGeometryFromText(geoText);
    if (!parsed) {
      toast.error("Invalid GeoJSON (need Polygon or MultiPolygon)");
      return;
    }
    setGeometryOverride(parsed);
    if (parsed.type === "Polygon") {
      setDrawPolygon(parsed as PolygonZoneGeometry);
    } else {
      setDrawPolygon(null);
    }
    toast.message("GeoJSON applied", {
      description: `${parsed.type} loaded. Save to persist.`,
    });
  };

  const handleDrawChange = useCallback((p: PolygonZoneGeometry | null) => {
    setDrawPolygon(p);
    setGeometryOverride(null);
    setGeoText(p ? JSON.stringify(p, null, 2) : "");
  }, []);

  const handleSubdivisionGeometryPick = useCallback(
    (geometry: PolygonZoneGeometry, meta: SubdivisionPickMeta) => {
      setDrawPolygon(geometry);
      setGeometryOverride(null);
      setGeoText(JSON.stringify(geometry, null, 2));
      setName((n) => (n.trim() ? n : `Delivery — ${meta.label}`));
      const codeFromKey =
        meta.key && meta.key.length > 0
          ? `SD-${meta.key.replace(/_/g, "-").toUpperCase()}`
          : "";
      const codeFromLabel = `SD-${meta.label
        .replace(/\s+/g, "-")
        .slice(0, 24)
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, "")}`;
      setCode((c) => (c.trim() ? c : codeFromKey || codeFromLabel));
      toast.success(`Boundary set to ${meta.label}`, {
        description: "Save the zone when you are ready.",
      });
    },
    [],
  );

  const handleSave = () => {
    const geom = geometryForSave(drawPolygon, geometryOverride, geoText);
    if (!name.trim() || !code.trim()) {
      toast.error("Name and code are required");
      return;
    }
    if (!geom) {
      toast.error(
        "Draw your zone on the map (pentagon tool, then double-click to finish), or open Advanced to paste GeoJSON.",
      );
      return;
    }

    const payload = {
      name: name.trim(),
      code: code.trim(),
      district: district.trim() || "Wayanad",
      geometry: geom,
      color: normalizePickerHex(color),
      sortOrder,
      isActive,
    };

    if (selectedId === "new" || selectedId === null) {
      createMut.mutate(payload);
    } else {
      updateMut.mutate({ id: selectedId, body: payload });
    }
  };

  const mapEditorKey = selectedId ?? "none";
  const isEditMode = Boolean(selectedId && selectedId !== "new");

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <Card className="border-white/5 bg-[#002833] text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Delivery zones</CardTitle>
          <Button
            size="sm"
            className="bg-[#98E32F] text-[#013644] hover:bg-[#86c926]"
            onClick={openNewZoneDialog}
          >
            <Plus className="mr-1 h-4 w-4" />
            New zone
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-white/40">
            Click <span className="text-[#98E32F]/90">New zone</span> to draw an
            area on the map, or select a zone to edit.
          </p>
          {isLoading ? (
            <div className="flex justify-center py-8 text-white/40">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <ul className="max-h-[min(60vh,28rem)] space-y-1 overflow-y-auto">
              {zones.map((z) => (
                <li key={z._id}>
                  <button
                    type="button"
                    onClick={() => openEditZoneDialog(z)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/5 ${
                      zoneDialogOpen && selectedId === z._id
                        ? "bg-[#98E32F]/20 text-[#98E32F]"
                        : "text-white/80"
                    }`}
                  >
                    <MapPin className="h-4 w-4 shrink-0 opacity-60" />
                    <span className="truncate font-medium">{z.name}</span>
                    <span className="shrink-0 text-xs text-white/40">
                      {z.code}
                    </span>
                    {!z.isActive && (
                      <span className="ml-auto text-[10px] uppercase text-red-400">
                        off
                      </span>
                    )}
                  </button>
                </li>
              ))}
              {zones.length === 0 && (
                <p className="py-6 text-center text-sm text-white/40">
                  No zones yet. Click{" "}
                  <span className="font-medium text-white/60">New zone</span> to
                  draw your first area.
                </p>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={zoneDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          showCloseButton
          className="max-h-[min(92vh,900px)] gap-0 overflow-y-auto border-white/10 bg-[#002833] p-0 text-white sm:max-w-[min(96vw,52rem)]"
        >
          <div className="sticky top-0 z-10 border-b border-white/10 bg-[#002833]/95 px-6 py-4 backdrop-blur-sm">
            <DialogHeader className="gap-1 text-left">
              <DialogTitle className="text-xl text-white">
                {isEditMode ? "Edit zone" : "New zone"}
              </DialogTitle>
              <DialogDescription className="text-white/50">
                {isEditMode
                  ? "Update details and boundary, then save."
                  : "Fill in the details and draw the delivery area on the map."}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/60">Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-white/10 bg-black/20 text-white"
                  placeholder="Kalpetta North"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/60">Code</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="border-white/10 bg-black/20 text-white"
                  placeholder="KLP-N"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/60">District</Label>
                <Input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="border-white/10 bg-black/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/60">Zone color</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={normalizePickerHex(color)}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-14 shrink-0 cursor-pointer border-white/10 bg-[#002833] p-1 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-md"
                    title="Pick zone color"
                  />
                  <span className="font-mono text-sm text-white/60">
                    {normalizePickerHex(color)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white/60">Sort order</Label>
                <Input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                  className="border-white/10 bg-black/20 text-white"
                />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="accent-[#98E32F]"
                  />
                  Active
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white/90">
                  Zone boundary
                </h3>
                <p className="text-xs text-white/45">
                  Draw on the map, use{" "}
                  <span className="text-white/55">Use subdivision as zone</span>{" "}
                  in the map panel, or paste GeoJSON (Advanced).
                </p>
              </div>
              <div className="relative h-[min(58vh,560px)] min-h-[320px] w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
                {!token ? (
                  <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 p-6 text-center text-white/50">
                    <p>Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to use the map.</p>
                  </div>
                ) : (
                  zoneDialogOpen && (
                    <ZoneMapEditor
                      key={mapEditorKey}
                      accessToken={token}
                      drawPolygon={drawPolygon}
                      onDrawPolygonChange={handleDrawChange}
                      readOnlyGeometry={readOnlyGeometry}
                      onSubdivisionGeometryPick={handleSubdivisionGeometryPick}
                    />
                  )
                )}
              </div>

              <details className="group rounded-xl border border-white/10 bg-[#002833] text-white open:border-[#98E32F]/25">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-white/80 marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-2">
                    <span>
                      Advanced — paste GeoJSON{" "}
                      <span className="font-normal text-white/40">
                        (MultiPolygon, imports)
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-[#98E32F] group-open:hidden">
                      Show
                    </span>
                    <span className="hidden shrink-0 text-xs text-[#98E32F] group-open:inline">
                      Hide
                    </span>
                  </span>
                </summary>
                <div className="space-y-3 border-t border-white/5 px-4 pb-4 pt-3">
                  <p className="text-xs text-white/45">
                    Only if you have coordinates from QGIS or geojson.io.
                  </p>
                  <Textarea
                    value={geoText}
                    onChange={(e) => setGeoText(e.target.value)}
                    className="min-h-[160px] border-white/10 bg-black/20 font-mono text-xs text-white"
                    placeholder='{"type":"Polygon","coordinates":[...]}'
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-white/10 text-white hover:bg-white/5"
                    onClick={applyGeoJson}
                  >
                    Apply GeoJSON
                  </Button>
                </div>
              </details>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 z-10 border-t border-white/10 bg-[#002833]/95 px-6 py-4 backdrop-blur-sm sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {isEditMode && (
                <Button
                  type="button"
                  variant="destructive"
                  className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  onClick={() => {
                    if (selectedId && selectedId !== "new") {
                      deleteMut.mutate(selectedId);
                    }
                  }}
                  disabled={deleteMut.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button
                type="button"
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5"
                onClick={() => handleDialogOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[#98E32F] text-[#013644] hover:bg-[#86c926]"
                onClick={handleSave}
                disabled={createMut.isPending || updateMut.isPending}
              >
                {(createMut.isPending || updateMut.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Save className="mr-2 h-4 w-4" />
                {isEditMode ? "Save changes" : "Create zone"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
