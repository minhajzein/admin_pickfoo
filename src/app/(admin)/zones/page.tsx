"use client";

import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { LsgPickMeta } from "@/components/zones/ZoneMapEditor";
import type {
  DeliveryZone,
  PolygonZoneGeometry,
  ZoneGeometry,
} from "@/types/models";
import wayanadLsgCatalog from "@/lib/wayanadLsgCatalog.json";
import { Loader2, MapPin, Plus, Save, Trash2 } from "lucide-react";

type LsgCatalogEntry = {
  key: string;
  name: string;
  lsgiCode: string;
  localAuth: string;
};

const LSG_CATALOG = wayanadLsgCatalog as LsgCatalogEntry[];

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
const PINCODE_RE = /^[1-9][0-9]{5}$/;

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

function codeFromLsgName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function localAuthLabel(auth: string): string {
  if (auth === "municipality") return "Municipality";
  if (auth === "gram_panchayat") return "Gram panchayat";
  return auth;
}

async function loadLsgGeometryByCode(
  lsgiCode: string,
): Promise<ZoneGeometry | null> {
  const res = await fetch("/geo/wayanad-lsg.geojson");
  if (!res.ok) return null;
  const fc = (await res.json()) as {
    features: {
      properties?: { lsgi_code?: string };
      geometry?: ZoneGeometry;
    }[];
  };
  const feat = fc.features.find(
    (f) =>
      String(f.properties?.lsgi_code ?? "").toUpperCase() ===
      lsgiCode.toUpperCase(),
  );
  if (!feat?.geometry) return null;
  const g = feat.geometry;
  if (g.type === "MultiPolygon" && g.coordinates.length === 1) {
    return {
      type: "Polygon",
      coordinates: g.coordinates[0] as number[][][],
    };
  }
  return g;
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
  const [lsgiCode, setLsgiCode] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pincode, setPincode] = useState("");
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
  const [loadingLsgGeom, setLoadingLsgGeom] = useState(false);

  const selectedLsg = useMemo(
    () => LSG_CATALOG.find((e) => e.lsgiCode === lsgiCode) ?? null,
    [lsgiCode],
  );

  const resetForm = useCallback(() => {
    setSelectedId(null);
    setLsgiCode("");
    setName("");
    setCode("");
    setPincode("");
    setDistrict("Wayanad");
    setColor(DEFAULT_ZONE_COLOR);
    setSortOrder(0);
    setIsActive(true);
    setGeoText("");
    setDrawPolygon(null);
    setGeometryOverride(null);
  }, []);

  const applyGeometry = useCallback((geom: ZoneGeometry) => {
    setGeometryOverride(geom.type === "MultiPolygon" ? geom : null);
    setGeoText(JSON.stringify(geom, null, 2));
    if (geom.type === "Polygon") {
      setDrawPolygon(geom as PolygonZoneGeometry);
    } else if (
      geom.type === "MultiPolygon" &&
      geom.coordinates.length === 1
    ) {
      const poly: PolygonZoneGeometry = {
        type: "Polygon",
        coordinates: geom.coordinates[0] as number[][][],
      };
      setDrawPolygon(poly);
      setGeometryOverride(null);
      setGeoText(JSON.stringify(poly, null, 2));
    } else {
      setDrawPolygon(null);
    }
  }, []);

  const applyLsgSelection = useCallback(
    async (entry: LsgCatalogEntry, opts?: { keepName?: boolean }) => {
      setLsgiCode(entry.lsgiCode);
      if (!opts?.keepName) {
        setName(entry.name);
        setCode(codeFromLsgName(entry.name));
      }
      setLoadingLsgGeom(true);
      try {
        const geom = await loadLsgGeometryByCode(entry.lsgiCode);
        if (!geom) {
          toast.error(`Could not load map for ${entry.name}`);
          return;
        }
        applyGeometry(geom);
        toast.success(`${entry.name} boundary loaded`);
      } finally {
        setLoadingLsgGeom(false);
      }
    },
    [applyGeometry],
  );

  const loadZoneIntoForm = useCallback((z: DeliveryZone) => {
    setSelectedId(z._id);
    setLsgiCode(z.lsgiCode ?? "");
    setName(z.name);
    setCode(z.code);
    setPincode(z.pincode ?? "");
    setDistrict(z.district);
    setColor(normalizePickerHex(z.color));
    setSortOrder(z.sortOrder ?? 0);
    setIsActive(z.isActive !== false);
    setGeoText(JSON.stringify(z.geometry, null, 2));
    setGeometryOverride(null);
    if (z.geometry.type === "Polygon") {
      setDrawPolygon(z.geometry as PolygonZoneGeometry);
    } else if (
      z.geometry.type === "MultiPolygon" &&
      z.geometry.coordinates.length === 1
    ) {
      setDrawPolygon({
        type: "Polygon",
        coordinates: z.geometry.coordinates[0] as number[][][],
      });
    } else {
      setDrawPolygon(null);
      if (z.geometry.type === "MultiPolygon") {
        setGeometryOverride(z.geometry);
      }
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
      if (z?.geometry.type === "MultiPolygon" && !drawPolygon) return z.geometry;
    }
    return null;
  }, [geometryOverride, selectedId, zones, drawPolygon]);

  const applyGeoJson = () => {
    const parsed = parseZoneGeometryFromText(geoText);
    if (!parsed) {
      toast.error("Invalid GeoJSON (need Polygon or MultiPolygon)");
      return;
    }
    applyGeometry(parsed);
    toast.message("GeoJSON applied", {
      description: `${parsed.type} loaded. Save to persist.`,
    });
  };

  const handleDrawChange = useCallback((p: PolygonZoneGeometry | null) => {
    setDrawPolygon(p);
    setGeometryOverride(null);
    setGeoText(p ? JSON.stringify(p, null, 2) : "");
  }, []);

  const handleLsgGeometryPick = useCallback(
    (geometry: ZoneGeometry, meta: LsgPickMeta) => {
      setLsgiCode(meta.lsgiCode);
      setName((n) => (n.trim() ? n : meta.label));
      setCode((c) => (c.trim() ? c : codeFromLsgName(meta.label)));
      applyGeometry(geometry);
      toast.success(`Zone set to ${meta.label}`, {
        description: meta.lsgiCode,
      });
    },
    [applyGeometry],
  );

  const handleLsgSelectChange = async (nextCode: string) => {
    if (!nextCode) {
      setLsgiCode("");
      return;
    }
    const entry = LSG_CATALOG.find((e) => e.lsgiCode === nextCode);
    if (!entry) return;
    await applyLsgSelection(entry);
  };

  // Prefetch LSG geojson once dialog opens so dropdown feels snappy
  useEffect(() => {
    if (!zoneDialogOpen) return;
    void fetch("/geo/wayanad-lsg.geojson");
  }, [zoneDialogOpen]);

  const handleSave = () => {
    const geom = geometryForSave(drawPolygon, geometryOverride, geoText);
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!lsgiCode.trim()) {
      toast.error("Select a local body (e.g. Mananthavady, Edavaka)");
      return;
    }
    if (pincode.trim() && !PINCODE_RE.test(pincode.trim())) {
      toast.error("Pincode must be a valid 6-digit PIN if provided");
      return;
    }
    if (!geom) {
      toast.error(
        "Select a local body to load its map area, or draw / paste GeoJSON.",
      );
      return;
    }

    const payload = {
      name: name.trim(),
      code: (code.trim() || codeFromLsgName(name)).toUpperCase(),
      lsgiCode: lsgiCode.trim().toUpperCase(),
      pincode: pincode.trim() || undefined,
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
            Zones are Wayanad local bodies — gram panchayats and municipalities
            (e.g. Mananthavady, Edavaka, Thavinhal, Panamaram).
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
                      {z.lsgiCode || z.code}
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
                  <span className="font-medium text-white/60">New zone</span> and
                  pick a local body.
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
                Choose a Wayanad gram panchayat or municipality — the map area
                loads automatically.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-white/60">Local body</Label>
                <select
                  value={lsgiCode}
                  onChange={(e) => void handleLsgSelectChange(e.target.value)}
                  className={`h-10 w-full rounded-md border px-3 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-[#98E32F]/40 ${
                    lsgiCode
                      ? "border-[#98E32F]/70 bg-[#001820] font-medium text-white"
                      : "border-white/20 bg-[#001820] text-white/70"
                  }`}
                >
                  <option value="" className="bg-[#001820] text-white/60">
                    Select panchayat / municipality…
                  </option>
                  {LSG_CATALOG.map((e) => (
                    <option
                      key={e.lsgiCode}
                      value={e.lsgiCode}
                      className="bg-[#001820] text-white"
                    >
                      {e.name} — {localAuthLabel(e.localAuth)} ({e.lsgiCode})
                    </option>
                  ))}
                </select>
                {selectedLsg && (
                  <p className="rounded-md border border-[#98E32F]/30 bg-[#001820] px-2.5 py-1.5 text-[11px] font-medium text-[#b8f04a]">
                    Selected: {selectedLsg.name} ·{" "}
                    {localAuthLabel(selectedLsg.localAuth)} · LSGI{" "}
                    <span className="font-mono text-white">
                      {selectedLsg.lsgiCode}
                    </span>
                    {loadingLsgGeom ? " · loading map…" : ""}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-white/60">Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-white/10 bg-black/20 text-white"
                  placeholder="Edavaka"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/60">Code</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="border-white/10 bg-black/20 text-white"
                  placeholder="EDAVAKA"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/60">
                  Pincode{" "}
                  <span className="font-normal text-white/35">(optional)</span>
                </Label>
                <Input
                  value={pincode}
                  onChange={(e) =>
                    setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="border-white/10 bg-black/20 font-mono text-white"
                  placeholder="670645"
                  inputMode="numeric"
                  maxLength={6}
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
                  Selecting a local body loads its map. You can also pick on the
                  map or paste GeoJSON (Advanced).
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
                      selectedLsgiCode={lsgiCode || null}
                      onLsgGeometryPick={handleLsgGeometryPick}
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
                disabled={
                  createMut.isPending ||
                  updateMut.isPending ||
                  loadingLsgGeom
                }
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
