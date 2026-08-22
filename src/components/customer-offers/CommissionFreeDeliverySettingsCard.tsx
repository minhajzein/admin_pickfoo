"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeliveryDining, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchCommissionFreeDeliverySettings,
  updateCommissionFreeDeliverySettings,
  type CommissionFreeDeliverySettings,
} from "@/lib/api/commission-free-delivery";

type FormState = {
  enabled: boolean;
  multiplier: string;
  title: string;
  subtitle: string;
  badgeLabel: string;
};

function toForm(data: CommissionFreeDeliverySettings): FormState {
  return {
    enabled: data.enabled,
    multiplier: String(data.multiplier),
    title: data.title,
    subtitle: data.subtitle,
    badgeLabel: data.badgeLabel,
  };
}

export function CommissionFreeDeliverySettingsCard() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["commission-free-delivery-settings"],
    queryFn: fetchCommissionFreeDeliverySettings,
  });

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: updateCommissionFreeDeliverySettings,
    onSuccess: async (saved) => {
      toast.success("Auto free delivery settings saved");
      setForm(toForm(saved));
      await queryClient.invalidateQueries({
        queryKey: ["commission-free-delivery-settings"],
      });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Save failed");
    },
  });

  const example = useMemo(() => {
    if (!form) return null;
    const mult = Number(form.multiplier);
    const deliveryFee = 40;
    const commissionPct = 20;
    if (!Number.isFinite(mult) || mult < 1 || commissionPct <= 0) return null;
    const target = Math.round((mult * deliveryFee * 100) / commissionPct);
    return {
      deliveryFee,
      commissionPct,
      target,
    };
  }, [form]);

  const onSave = () => {
    if (!form) return;
    const multiplier = Number(form.multiplier);
    if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 20) {
      toast.error("Multiplier must be between 1 and 20");
      return;
    }
    if (!form.title.trim() || !form.subtitle.trim() || !form.badgeLabel.trim()) {
      toast.error("Title, subtitle, and badge are required");
      return;
    }
    saveMutation.mutate({
      enabled: form.enabled,
      multiplier,
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      badgeLabel: form.badgeLabel.trim(),
    });
  };

  if (isLoading || !form) {
    return (
      <Card className="border-white/10 bg-white/5 text-white shadow-none">
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-7 w-7 animate-spin text-[#98E32F]" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-red-500/30 bg-red-500/10 text-red-200 shadow-none">
        <CardContent className="py-6">
          {error instanceof Error ? error.message : "Failed to load settings"}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#98E32F]/25 bg-[#042c38] text-white shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <DeliveryDining className="h-5 w-5 text-[#98E32F]" />
          Auto free delivery (item-total rule)
        </CardTitle>
        <p className="text-sm text-white/60 leading-relaxed">
          When a restaurant&apos;s platform share on an order is at least{" "}
          <span className="text-white/80">multiplier × delivery fee</span>, the
          customer gets free delivery. The delivery partner is still paid from
          the restaurant commission pool. Customers only see item totals in the
          app — never commission.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="flex items-center gap-3 text-sm text-white/90">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="h-4 w-4 accent-[#98E32F]"
          />
          Enable auto free delivery
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Commission multiplier</Label>
            <Input
              type="number"
              min={1}
              max={20}
              step={0.5}
              value={form.multiplier}
              onChange={(e) => setForm({ ...form, multiplier: e.target.value })}
              className="border-white/10 bg-black/20"
            />
            <p className="text-xs text-white/45">
              Default 2 — platform share must cover 2× delivery fee.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Badge label (customer app)</Label>
            <Input
              value={form.badgeLabel}
              onChange={(e) => setForm({ ...form, badgeLabel: e.target.value })}
              className="border-white/10 bg-black/20"
              maxLength={16}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Offer title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="border-white/10 bg-black/20"
              maxLength={160}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Offer subtitle</Label>
            <Input
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              className="border-white/10 bg-black/20"
              maxLength={240}
            />
          </div>
        </div>

        {example && form.enabled && (
          <div className="rounded-xl border border-[#98E32F]/20 bg-[#98E32F]/5 px-4 py-3 text-sm text-white/75">
            Example at {example.commissionPct}% restaurant rate and ₹
            {example.deliveryFee} delivery: customer needs{" "}
            <span className="font-bold text-[#98E32F]">
              ₹{example.target.toLocaleString("en-IN")}+
            </span>{" "}
            in items for free delivery.
          </div>
        )}

        <Button
          onClick={onSave}
          disabled={saveMutation.isPending}
          className="bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90"
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save auto free delivery
        </Button>
      </CardContent>
    </Card>
  );
}
