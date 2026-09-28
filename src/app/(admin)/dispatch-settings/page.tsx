"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Layers, Loader2, Route, Save, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchDispatchSettings,
  updateDispatchSettings,
  type DispatchPeakMode,
  type DispatchSettings,
} from "@/lib/api/dispatch-settings";

type BooleanField =
  | "batchingEnabled"
  | "allowSameRestaurant"
  | "allowCrossRestaurant"
  | "allowOnRoute"
  | "allowSameCustomer"
  | "autoSplitDelayed";

type NumberField =
  | "maxRestaurantDistanceKm"
  | "maxDropDistanceKm"
  | "maxSingleOrderKm"
  | "maxCombinedRouteKm"
  | "maxFirstOrderExtraMinutes"
  | "maxPrepGapMinutes"
  | "firstOrderLateAfterMinutes"
  | "restaurantOverloadOpenOrders"
  | "restaurantOverloadLateOrders"
  | "peakFreeRiderThreshold"
  | "secondOrderPayoutPercent";

type FormState = Record<BooleanField, boolean> &
  Record<NumberField, string> & {
    peakMode: DispatchPeakMode;
    peakHours: string;
  };

type NumberFieldSpec = {
  key: NumberField;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: string;
  integer?: boolean;
};

const BOOLEAN_FIELDS: BooleanField[] = [
  "batchingEnabled",
  "allowSameRestaurant",
  "allowCrossRestaurant",
  "allowOnRoute",
  "allowSameCustomer",
  "autoSplitDelayed",
];

const ROUTE_FIELDS: NumberFieldSpec[] = [
  {
    key: "maxDropDistanceKm",
    label: "Max distance between customers (km)",
    hint: "Straight-line pre-filter between the two drop locations.",
    min: 0,
    max: 30,
    step: "0.1",
  },
  {
    key: "maxRestaurantDistanceKm",
    label: "Max distance between restaurants (km)",
    hint: "Nearby-restaurant double orders only.",
    min: 0,
    max: 20,
    step: "0.1",
  },
  {
    key: "maxSingleOrderKm",
    label: "Max single order route (km)",
    hint: "Road distance restaurant → customer for each order.",
    min: 0.5,
    max: 50,
    step: "0.1",
  },
  {
    key: "maxCombinedRouteKm",
    label: "Max combined route (km)",
    hint: "Total road distance for both pickups and drops.",
    min: 0.5,
    max: 60,
    step: "0.1",
  },
  {
    key: "maxFirstOrderExtraMinutes",
    label: "Max extra delay for first customer (min)",
    hint: "How much later the first order may arrive because of the second.",
    min: 0,
    max: 60,
    step: "1",
  },
  {
    key: "secondOrderPayoutPercent",
    label: "Second order payout (%)",
    hint: "Share of the delivery fee for the second order. Tips are paid in full.",
    min: 0,
    max: 100,
    step: "1",
  },
];

const TIMING_FIELDS: NumberFieldSpec[] = [
  {
    key: "maxPrepGapMinutes",
    label: "Max prep-time gap (min)",
    hint: "Skip pairing when one order will be ready much later than the other. Also used for auto-split.",
    min: 0,
    max: 120,
    step: "1",
  },
  {
    key: "firstOrderLateAfterMinutes",
    label: "First order is late after (min)",
    hint: "Never add a second order to an order older than this.",
    min: 5,
    max: 240,
    step: "1",
    integer: true,
  },
  {
    key: "restaurantOverloadOpenOrders",
    label: "Restaurant overload: open orders",
    hint: "Block batching when a restaurant has this many confirmed/preparing orders.",
    min: 1,
    max: 200,
    step: "1",
    integer: true,
  },
  {
    key: "restaurantOverloadLateOrders",
    label: "Restaurant overload: late orders",
    hint: "…or this many orders running past their ready time.",
    min: 1,
    max: 100,
    step: "1",
    integer: true,
  },
];

const PEAK_FIELDS: NumberFieldSpec[] = [
  {
    key: "peakFreeRiderThreshold",
    label: "Low supply: free riders nearby ≤",
    hint: "In auto mode, batch proactively when this few free riders are available.",
    min: 0,
    max: 100,
    step: "1",
    integer: true,
  },
];

const ALL_NUMBER_FIELDS = [...ROUTE_FIELDS, ...TIMING_FIELDS, ...PEAK_FIELDS];

const PEAK_HOURS_PATTERN =
  /^\s*([01]?\d|2[0-3]):[0-5]\d\s*-\s*(([01]?\d|2[0-3]):[0-5]\d|24:00)\s*$/;

function toForm(data: DispatchSettings): FormState {
  const form = {
    peakMode: data.peakMode ?? "auto",
    peakHours: data.peakHours ?? "",
  } as FormState;
  for (const key of BOOLEAN_FIELDS) form[key] = Boolean(data[key]);
  for (const { key } of ALL_NUMBER_FIELDS) form[key] = String(data[key] ?? "");
  return form;
}

function parseField(raw: string, spec: NumberFieldSpec): number {
  const n = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(n) || n < spec.min || n > spec.max) {
    throw new Error(`${spec.label} must be between ${spec.min} and ${spec.max}`);
  }
  if (spec.integer && !Number.isInteger(n)) {
    throw new Error(`${spec.label} must be a whole number`);
  }
  return n;
}

function validatePeakHours(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const bad = value.split(",").find((part) => !PEAK_HOURS_PATTERN.test(part));
  if (bad !== undefined) {
    throw new Error('Peak hours must look like "12:00-14:30,19:00-22:30"');
  }
  return value;
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-black/20 p-4 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-semibold text-white">
          {label}
        </Label>
        <p className="text-xs text-white/50">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-[#98E32F]" : "bg-white/20"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function NumberFieldGrid({
  fields,
  form,
  disabled,
  onChange,
}: {
  fields: NumberFieldSpec[];
  form: FormState;
  disabled?: boolean;
  onChange: (key: NumberField, value: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((spec) => (
        <div key={spec.key} className="space-y-2">
          <Label htmlFor={spec.key}>{spec.label}</Label>
          <Input
            id={spec.key}
            type="number"
            min={spec.min}
            max={spec.max}
            step={spec.step}
            disabled={disabled}
            value={form[spec.key]}
            onChange={(e) => onChange(spec.key, e.target.value)}
            className="bg-black/20 border-white/10"
          />
          <p className="text-xs text-white/40">{spec.hint}</p>
        </div>
      ))}
    </div>
  );
}

const PEAK_MODE_OPTIONS: { value: DispatchPeakMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "auto", label: "Auto (peak hours or low supply)" },
  { value: "always", label: "Always" },
];

export default function DispatchSettingsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<FormState | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dispatch-settings"],
    queryFn: fetchDispatchSettings,
  });

  const form = draft ?? (data ? toForm(data) : null);

  const saveMutation = useMutation({
    mutationFn: updateDispatchSettings,
    onSuccess: async (saved) => {
      toast.success("Dispatch settings updated");
      queryClient.setQueryData(["dispatch-settings"], saved);
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["dispatch-settings"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Update failed");
    },
  });

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setDraft((prev) => {
      const base = prev ?? (data ? toForm(data) : null);
      return base ? { ...base, [key]: value } : base;
    });
  };

  const onSave = () => {
    if (!form) return;
    try {
      const payload: Partial<Omit<DispatchSettings, "updatedAt">> = {
        maxOrdersPerPartner: 2,
        peakMode: form.peakMode,
        peakHours: validatePeakHours(form.peakHours),
      };
      for (const key of BOOLEAN_FIELDS) payload[key] = form[key];
      for (const spec of ALL_NUMBER_FIELDS) payload[spec.key] = parseField(form[spec.key], spec);
      saveMutation.mutate(payload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid values");
    }
  };

  if (isError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
        {error instanceof Error ? error.message : "Failed to load dispatch settings"}
      </div>
    );
  }

  if (isLoading || !form) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white/60">
        <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
      </div>
    );
  }

  const batchingOff = !form.batchingEnabled;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-white/60 max-w-2xl">
          Double orders let a partner carry two orders at once. A second order is
          offered as a separate request the partner can accept or reject within the
          normal offer window. Every pairing is checked against road distance, prep
          times and restaurant load before it is offered. Per-partner opt-out is on
          each partner&apos;s profile.
        </p>
      </div>

      <Card className="border-white/10 bg-white/5 text-white shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5 text-[#98E32F]" />
            Double orders
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <ToggleRow
            id="batchingEnabled"
            label="Enable double orders"
            description="Master switch. When off, every partner carries one order at a time."
            checked={form.batchingEnabled}
            onChange={(v) => setField("batchingEnabled", v)}
          />
          <ToggleRow
            id="allowSameRestaurant"
            label="Same restaurant"
            description="Offer a second order from the restaurant the partner is already heading to (tried before free partners)."
            checked={form.allowSameRestaurant}
            disabled={batchingOff}
            onChange={(v) => setField("allowSameRestaurant", v)}
          />
          <ToggleRow
            id="allowCrossRestaurant"
            label="Nearby restaurant"
            description="Offer a second order from a different restaurant close to the first one (when no free partner is available, or during peak)."
            checked={form.allowCrossRestaurant}
            disabled={batchingOff}
            onChange={(v) => setField("allowCrossRestaurant", v)}
          />
          <ToggleRow
            id="allowSameCustomer"
            label="Same customer / address"
            description="Pair orders going to the same customer or address (even from different restaurants) and hand them over together."
            checked={form.allowSameCustomer}
            disabled={batchingOff}
            onChange={(v) => setField("allowSameCustomer", v)}
          />
          <ToggleRow
            id="allowOnRoute"
            label="On-route pickup"
            description="Allow adding a second order after the partner has picked up the first, if the restaurant is on the way."
            checked={form.allowOnRoute}
            disabled={batchingOff}
            onChange={(v) => setField("allowOnRoute", v)}
          />
          <ToggleRow
            id="autoSplitDelayed"
            label="Auto-split delayed orders"
            description="When the partner picks up one order and the other restaurant is running late, release the late order to another partner."
            checked={form.autoSplitDelayed}
            disabled={batchingOff}
            onChange={(v) => setField("autoSplitDelayed", v)}
          />
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5 text-white shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Route className="h-5 w-5 text-[#98E32F]" />
            Route limits & payout
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NumberFieldGrid
            fields={ROUTE_FIELDS}
            form={form}
            onChange={(k, v) => setField(k, v)}
          />
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5 text-white shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-[#98E32F]" />
            Timing & restaurant load
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NumberFieldGrid
            fields={TIMING_FIELDS}
            form={form}
            onChange={(k, v) => setField(k, v)}
          />
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5 text-white shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-[#98E32F]" />
            Peak batching
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-white/50 max-w-2xl">
            During peak, nearby-restaurant double orders are tried even when free
            partners exist, and waiting orders are re-checked every minute so they
            can join a partner who just became eligible.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="peakMode">Mode</Label>
              <select
                id="peakMode"
                value={form.peakMode}
                onChange={(e) => setField("peakMode", e.target.value as DispatchPeakMode)}
                className="flex h-9 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-white"
              >
                {PEAK_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#013644]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="peakHours">Peak hours (IST)</Label>
              <Input
                id="peakHours"
                value={form.peakHours}
                placeholder="12:00-14:30,19:00-22:30"
                disabled={form.peakMode !== "auto"}
                onChange={(e) => setField("peakHours", e.target.value)}
                className="bg-black/20 border-white/10"
              />
              <p className="text-xs text-white/40">Comma-separated HH:MM-HH:MM ranges.</p>
            </div>
          </div>
          <NumberFieldGrid
            fields={PEAK_FIELDS}
            form={form}
            disabled={form.peakMode !== "auto"}
            onChange={(k, v) => setField(k, v)}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={onSave}
          disabled={saveMutation.isPending}
          className="bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90 font-semibold"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save changes
        </Button>
      </div>
    </div>
  );
}
