"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IndianRupee, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchDeliveryCharges,
  updateDeliveryCharges,
  type DeliveryChargeSettings,
} from "@/lib/api/delivery-charges";

type FormState = {
  minKm: string;
  ecoBaseFee: string;
  ecoPerKm: string;
  standardBaseFee: string;
  standardPerKm: string;
};

function toForm(data: DeliveryChargeSettings): FormState {
  return {
    minKm: String(data.minKm),
    ecoBaseFee: String(data.ecoBaseFee),
    ecoPerKm: String(data.ecoPerKm),
    standardBaseFee: String(data.standardBaseFee),
    standardPerKm: String(data.standardPerKm),
  };
}

function parseNonNeg(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return n;
}

export default function DeliveryChargesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["delivery-charges"],
    queryFn: fetchDeliveryCharges,
  });

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: updateDeliveryCharges,
    onSuccess: async (saved) => {
      toast.success("Delivery charges updated");
      setForm(toForm(saved));
      await queryClient.invalidateQueries({ queryKey: ["delivery-charges"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Update failed");
    },
  });

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const onSave = () => {
    if (!form) return;
    try {
      saveMutation.mutate({
        minKm: parseNonNeg(form.minKm, "Min km"),
        ecoBaseFee: parseNonNeg(form.ecoBaseFee, "Eco minimum charge"),
        ecoPerKm: parseNonNeg(form.ecoPerKm, "Eco per km"),
        standardBaseFee: parseNonNeg(
          form.standardBaseFee,
          "Standard minimum charge",
        ),
        standardPerKm: parseNonNeg(form.standardPerKm, "Standard per km"),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid values");
    }
  };

  if (isLoading || !form) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white/60">
        <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
        {error instanceof Error
          ? error.message
          : "Failed to load delivery charges"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-white/60 max-w-2xl">
          Platform delivery pricing for customer checkout. Minimum charge covers
          up to the min km; each km beyond that adds the per-km rate.
        </p>
      </div>

      <Card className="border-white/10 bg-white/5 text-white shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <IndianRupee className="h-5 w-5 text-[#98E32F]" />
            Distance rules
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="minKm">Minimum distance (km)</Label>
            <Input
              id="minKm"
              type="number"
              min={0}
              step="0.1"
              value={form.minKm}
              onChange={(e) => setField("minKm", e.target.value)}
              className="bg-black/20 border-white/10"
            />
            <p className="text-xs text-white/40">
              Minimum charge applies for deliveries within this distance.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/10 bg-white/5 text-white shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">Eco Saver</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="ecoBaseFee">
                Minimum charge (₹, within min km)
              </Label>
              <Input
                id="ecoBaseFee"
                type="number"
                min={0}
                step="1"
                value={form.ecoBaseFee}
                onChange={(e) => setField("ecoBaseFee", e.target.value)}
                className="bg-black/20 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ecoPerKm">Per km above min (₹)</Label>
              <Input
                id="ecoPerKm"
                type="number"
                min={0}
                step="1"
                value={form.ecoPerKm}
                onChange={(e) => setField("ecoPerKm", e.target.value)}
                className="bg-black/20 border-white/10"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 text-white shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">Standard</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="standardBaseFee">
                Minimum charge (₹, within min km)
              </Label>
              <Input
                id="standardBaseFee"
                type="number"
                min={0}
                step="1"
                value={form.standardBaseFee}
                onChange={(e) => setField("standardBaseFee", e.target.value)}
                className="bg-black/20 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="standardPerKm">Per km above min (₹)</Label>
              <Input
                id="standardPerKm"
                type="number"
                min={0}
                step="1"
                value={form.standardPerKm}
                onChange={(e) => setField("standardPerKm", e.target.value)}
                className="bg-black/20 border-white/10"
              />
            </div>
          </CardContent>
        </Card>
      </div>

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
