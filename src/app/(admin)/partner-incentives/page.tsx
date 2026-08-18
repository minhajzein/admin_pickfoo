"use client";

import { useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  activatePartnerIncentive,
  createPartnerIncentive,
  fetchPartnerIncentiveProgress,
  fetchPartnerIncentives,
  updatePartnerIncentive,
} from "@/lib/api/partner-incentives";
import type {
  AdminPartnerIncentive,
  PartnerIncentiveAudience,
  PartnerIncentiveType,
} from "@/types/models";
import { ListPagination } from "@/components/ui/list-pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

function toLocalInput(dt: Date): string {
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

const typeLabels: Record<PartnerIncentiveType, string> = {
  challenge: "Challenge (conditions)",
  clean_window: "No reject/timeout window",
  streak: "Consecutive deliveries",
  daily_count: "Complete N in a day",
};

type IncentiveFormState = {
  title: string;
  body: string;
  type: PartnerIncentiveType;
  rewardAmountInr: number;
  rewardMode: "flat" | "guaranteed_total";
  startsAt: string;
  endsAt: string;
  streakTarget: number;
  dailyTarget: number;
  requireMinDeliveries: number;
  loseOnRejectOrTimeout: boolean;
  enableAcceptRate: boolean;
  minAcceptRatePercent: number;
  enableOnlineHours: boolean;
  minOnlineHours: number;
  enableOnlineShift: boolean;
  onlineWindowStart: string;
  onlineWindowEnd: string;
  breakMinutesAllowed: number;
  enableMinDeliveries: boolean;
  minDeliveries: number;
  audience: PartnerIncentiveAudience;
  partnerIdsRaw: string;
  zoneIdsRaw: string;
  publishNow: boolean;
  showLegacyTypes: boolean;
};

function emptyForm(now = new Date()): IncentiveFormState {
  return {
    title: "",
    body: "",
    type: "challenge",
    rewardAmountInr: 500,
    rewardMode: "guaranteed_total",
    startsAt: toLocalInput(now),
    endsAt: toLocalInput(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
    streakTarget: 10,
    dailyTarget: 10,
    requireMinDeliveries: 1,
    loseOnRejectOrTimeout: false,
    enableAcceptRate: false,
    minAcceptRatePercent: 100,
    enableOnlineHours: false,
    minOnlineHours: 11,
    enableOnlineShift: false,
    onlineWindowStart: "16:00",
    onlineWindowEnd: "23:00",
    breakMinutesAllowed: 25,
    enableMinDeliveries: false,
    minDeliveries: 10,
    audience: "all",
    partnerIdsRaw: "",
    zoneIdsRaw: "",
    publishNow: true,
    showLegacyTypes: false,
  };
}

function formFromOffer(row: AdminPartnerIncentive): IncentiveFormState {
  const c = row.conditions;
  const isLegacy = row.type !== "challenge";
  return {
    title: row.title,
    body: row.body,
    type: row.type,
    rewardAmountInr: row.rewardAmountInr,
    rewardMode: row.rewardMode === "flat" ? "flat" : "guaranteed_total",
    startsAt: toLocalInput(new Date(row.startsAt)),
    endsAt: toLocalInput(new Date(row.endsAt)),
    streakTarget: row.streakTarget ?? 10,
    dailyTarget: row.dailyTarget ?? 10,
    requireMinDeliveries: row.requireMinDeliveries ?? 1,
    loseOnRejectOrTimeout: c?.loseOnRejectOrTimeout !== false,
    enableAcceptRate: c?.minAcceptRatePercent != null,
    minAcceptRatePercent: c?.minAcceptRatePercent ?? 100,
    enableOnlineHours: c?.minOnlineHours != null,
    minOnlineHours: c?.minOnlineHours ?? 11,
    enableOnlineShift: !!(c?.onlineWindowStart && c?.onlineWindowEnd),
    onlineWindowStart: c?.onlineWindowStart || "16:00",
    onlineWindowEnd: c?.onlineWindowEnd || "23:00",
    breakMinutesAllowed: c?.breakMinutesAllowed ?? 25,
    enableMinDeliveries: c?.minDeliveries != null,
    minDeliveries: c?.minDeliveries ?? 10,
    audience: row.audience,
    partnerIdsRaw: (row.partnerIds || []).join(", "),
    zoneIdsRaw: (row.zoneIds || []).join(", "),
    publishNow: false,
    showLegacyTypes: isLegacy,
  };
}

function buildIncentivePayload(form: IncentiveFormState) {
  const partnerIds = form.partnerIdsRaw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const zoneIds = form.zoneIdsRaw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    title: form.title.trim(),
    body: form.body.trim(),
    type: form.type,
    rewardAmountInr: Number(form.rewardAmountInr),
    rewardMode: form.rewardMode,
    startsAt: new Date(form.startsAt).toISOString(),
    endsAt: new Date(form.endsAt).toISOString(),
    streakTarget:
      form.type === "streak" ? Number(form.streakTarget) : undefined,
    dailyTarget:
      form.type === "daily_count" ? Number(form.dailyTarget) : undefined,
    requireMinDeliveries:
      form.type === "clean_window"
        ? Number(form.requireMinDeliveries)
        : undefined,
    conditions:
      form.type === "challenge"
        ? {
            loseOnRejectOrTimeout: form.loseOnRejectOrTimeout,
            enableAcceptRate: form.enableAcceptRate,
            minAcceptRatePercent: form.enableAcceptRate
              ? form.minAcceptRatePercent
              : undefined,
            enableOnlineHours: form.enableOnlineHours,
            minOnlineHours: form.enableOnlineHours
              ? form.minOnlineHours
              : undefined,
            enableOnlineShift: form.enableOnlineShift,
            onlineWindowStart: form.enableOnlineShift
              ? form.onlineWindowStart
              : undefined,
            onlineWindowEnd: form.enableOnlineShift
              ? form.onlineWindowEnd
              : undefined,
            breakMinutesAllowed: form.enableOnlineShift
              ? form.breakMinutesAllowed
              : undefined,
            enableMinDeliveries: form.enableMinDeliveries,
            minDeliveries: form.enableMinDeliveries
              ? form.minDeliveries
              : undefined,
          }
        : undefined,
    audience: form.audience,
    partnerIds: form.audience === "partners" ? partnerIds : [],
    zoneIds: form.audience === "zones" ? zoneIds : [],
  };
}

export default function PartnerIncentivesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<IncentiveFormState>(() => emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminPartnerIncentive | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["partner-incentives", page],
    queryFn: () =>
      fetchPartnerIncentives({ page, limit: DEFAULT_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const progressQuery = useQuery({
    queryKey: ["partner-incentive-progress", selected?.id],
    queryFn: () => fetchPartnerIncentiveProgress(selected!.id),
    enabled: progressOpen && !!selected?.id,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const createMutation = useMutation({
    mutationFn: createPartnerIncentive,
    onSuccess: async () => {
      toast.success("Incentive offer created");
      setForm(emptyForm());
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ["partner-incentives"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Create failed");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: ReturnType<typeof buildIncentivePayload>;
    }) => updatePartnerIncentive(id, payload),
    onSuccess: async () => {
      toast.success("Incentive offer updated");
      setEditingId(null);
      setForm(emptyForm());
      await queryClient.invalidateQueries({ queryKey: ["partner-incentives"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Update failed");
    },
  });

  const activateMutation = useMutation({
    mutationFn: activatePartnerIncentive,
    onSuccess: async () => {
      toast.success("Offer activated — partners notified");
      await queryClient.invalidateQueries({ queryKey: ["partner-incentives"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Activate failed");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      updatePartnerIncentive(id, { status: "cancelled" }),
    onSuccess: async () => {
      toast.success("Offer cancelled");
      await queryClient.invalidateQueries({ queryKey: ["partner-incentives"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.type === "challenge") {
      const anyCond =
        form.loseOnRejectOrTimeout ||
        form.enableAcceptRate ||
        form.enableOnlineHours ||
        form.enableOnlineShift ||
        form.enableMinDeliveries;
      if (!anyCond) {
        toast.error("Enable at least one condition");
        return;
      }
    }

    const payload = buildIncentivePayload(form);
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
      return;
    }
    createMutation.mutate({
      ...payload,
      publishNow: form.publishNow,
    });
  };

  const beginEdit = (row: AdminPartnerIncentive) => {
    setEditingId(row.id);
    setForm(formFromOffer(row));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Partner incentives
        </h1>
        <p className="text-sm text-muted-foreground">
          Create challenge offers with stacked conditions. Rewards auto-credit
          to Pocket when earned; partners are notified on activate / miss /
          earn.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-4 w-4" />
            {editingId ? "Edit offer" : "Create offer"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="100% accept + 11h online today"
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <textarea
                className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.body}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value }))
                }
                placeholder="Stay online 11 hours with 100% accept rate. Reject or timeout loses the offer."
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Reward (₹)</Label>
              <Input
                type="number"
                min={1}
                value={form.rewardAmountInr}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    rewardAmountInr: Number(e.target.value),
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Reward mode</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.rewardMode}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    rewardMode: e.target.value as "flat" | "guaranteed_total",
                  }))
                }
              >
                <option value="guaranteed_total">
                  Guaranteed total (top-up earnings to ₹ amount)
                </option>
                <option value="flat">Flat bonus (credit full ₹ amount)</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    type: "challenge",
                    title: "₹500 guaranteed",
                    body: "Daily earnings + bonus. Stay online 4pm–11pm with 100% accept rate. 25 minutes break available.",
                    rewardAmountInr: 500,
                    rewardMode: "guaranteed_total",
                    loseOnRejectOrTimeout: true,
                    enableAcceptRate: true,
                    minAcceptRatePercent: 100,
                    enableOnlineHours: false,
                    enableOnlineShift: true,
                    onlineWindowStart: "16:00",
                    onlineWindowEnd: "23:00",
                    breakMinutesAllowed: 25,
                    enableMinDeliveries: false,
                  }))
                }
              >
                Load preset: ₹500 guaranteed (4–11pm)
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.audience}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    audience: e.target.value as PartnerIncentiveAudience,
                  }))
                }
              >
                <option value="all">All verified partners</option>
                <option value="zones">Zones</option>
                <option value="partners">Specific partners</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Starts</Label>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startsAt: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Ends (expires)</Label>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endsAt: e.target.value }))
                }
                required
              />
            </div>

            {form.audience === "zones" && (
              <div className="space-y-2 md:col-span-2">
                <Label>Zone IDs (comma-separated)</Label>
                <Input
                  value={form.zoneIdsRaw}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, zoneIdsRaw: e.target.value }))
                  }
                />
              </div>
            )}
            {form.audience === "partners" && (
              <div className="space-y-2 md:col-span-2">
                <Label>Partner IDs (comma-separated)</Label>
                <Input
                  value={form.partnerIdsRaw}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, partnerIdsRaw: e.target.value }))
                  }
                />
              </div>
            )}

            <div className="md:col-span-2 space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Conditions (all must pass)</p>
                  <p className="text-xs text-muted-foreground">
                    Challenge type — stack accept rate, online hours, deliveries,
                    and lose-on-reject.
                  </p>
                </div>
                <Badge variant="secondary">challenge</Badge>
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.loseOnRejectOrTimeout}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      loseOnRejectOrTimeout: e.target.checked,
                      type: "challenge",
                    }))
                  }
                />
                <span>
                  Lose offer on reject or timeout
                  <span className="block text-xs text-muted-foreground">
                    Partner is notified immediately when this happens.
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.enableAcceptRate}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        enableAcceptRate: e.target.checked,
                        type: "challenge",
                      }))
                    }
                  />
                  Min accept rate %
                </label>
                <Input
                  className="w-24"
                  type="number"
                  min={1}
                  max={100}
                  disabled={!form.enableAcceptRate}
                  value={form.minAcceptRatePercent}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      minAcceptRatePercent: Number(e.target.value),
                    }))
                  }
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.enableOnlineHours}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        enableOnlineHours: e.target.checked,
                        type: "challenge",
                      }))
                    }
                  />
                  Min online hours (cumulative)
                </label>
                <Input
                  className="w-24"
                  type="number"
                  min={0.5}
                  step={0.5}
                  disabled={!form.enableOnlineHours}
                  value={form.minOnlineHours}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      minOnlineHours: Number(e.target.value),
                    }))
                  }
                />
              </div>

              <div className="space-y-2 rounded-md border border-dashed p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.enableOnlineShift}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        enableOnlineShift: e.target.checked,
                        type: "challenge",
                      }))
                    }
                  />
                  Peak shift online window (IST)
                </label>
                <div className="flex flex-wrap items-end gap-3 text-sm">
                  <div className="space-y-1">
                    <Label className="text-xs">From</Label>
                    <Input
                      className="w-28"
                      type="time"
                      disabled={!form.enableOnlineShift}
                      value={form.onlineWindowStart}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          onlineWindowStart: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To</Label>
                    <Input
                      className="w-28"
                      type="time"
                      disabled={!form.enableOnlineShift}
                      value={form.onlineWindowEnd}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          onlineWindowEnd: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Break allowed (min)</Label>
                    <Input
                      className="w-24"
                      type="number"
                      min={0}
                      disabled={!form.enableOnlineShift}
                      value={form.breakMinutesAllowed}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          breakMinutesAllowed: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Required online = window length − break. Exceeding break fails
                  the offer.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.enableMinDeliveries}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        enableMinDeliveries: e.target.checked,
                        type: "challenge",
                      }))
                    }
                  />
                  Min deliveries
                </label>
                <Input
                  className="w-24"
                  type="number"
                  min={1}
                  disabled={!form.enableMinDeliveries}
                  value={form.minDeliveries}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      minDeliveries: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <button
                type="button"
                className="text-xs text-muted-foreground underline"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    showLegacyTypes: !f.showLegacyTypes,
                  }))
                }
              >
                {form.showLegacyTypes
                  ? "Hide legacy offer types"
                  : "Show legacy offer types"}
              </button>
            </div>

            {form.showLegacyTypes && (
              <>
                <div className="space-y-2">
                  <Label>Legacy type</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={form.type}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        type: e.target.value as PartnerIncentiveType,
                      }))
                    }
                  >
                    <option value="challenge">{typeLabels.challenge}</option>
                    <option value="daily_count">{typeLabels.daily_count}</option>
                    <option value="streak">{typeLabels.streak}</option>
                    <option value="clean_window">{typeLabels.clean_window}</option>
                  </select>
                </div>
                {form.type === "streak" && (
                  <div className="space-y-2">
                    <Label>Streak target (orders in a row)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.streakTarget}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          streakTarget: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                )}
                {form.type === "daily_count" && (
                  <div className="space-y-2">
                    <Label>Daily delivery target</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.dailyTarget}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          dailyTarget: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                )}
                {form.type === "clean_window" && (
                  <div className="space-y-2">
                    <Label>Min deliveries to earn (no reject/timeout)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.requireMinDeliveries}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          requireMinDeliveries: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                )}
              </>
            )}

            {!editingId && (
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={form.publishNow}
                onChange={(e) =>
                  setForm((f) => ({ ...f, publishNow: e.target.checked }))
                }
              />
              Activate &amp; notify partners now (if start time has begun)
            </label>
            )}
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingId ? "Save changes" : "Create offer"}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Offers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reward</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const counts = row.progressCounts || {};
                    const c = row.conditions;
                    const condSummary =
                      row.type === "challenge" && c
                        ? [
                            c.loseOnRejectOrTimeout ? "no reject" : null,
                            c.minAcceptRatePercent != null
                              ? `${c.minAcceptRatePercent}% accept`
                              : null,
                            c.minOnlineHours != null
                              ? `${c.minOnlineHours}h online`
                              : null,
                            c.onlineWindowStart && c.onlineWindowEnd
                              ? `${c.onlineWindowStart}–${c.onlineWindowEnd}${
                                  c.breakMinutesAllowed != null
                                    ? ` (${c.breakMinutesAllowed}m break)`
                                    : ""
                                }`
                              : null,
                            c.minDeliveries != null
                              ? `${c.minDeliveries} deliveries`
                              : null,
                            row.rewardMode === "guaranteed_total"
                              ? "guaranteed"
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : typeLabels[row.type];
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          <div>{row.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {condSummary}
                          </div>
                        </TableCell>
                        <TableCell>{typeLabels[row.type]}</TableCell>
                        <TableCell>₹{row.rewardAmountInr}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{row.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          earned {counts.earned ?? 0} · missed{" "}
                          {counts.missed ?? 0} · active {counts.active ?? 0}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(row.startsAt).toLocaleString()} →{" "}
                          {new Date(row.endsAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="space-x-2 text-right">
                          {row.status !== "cancelled" &&
                            row.status !== "ended" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => beginEdit(row)}
                              >
                                Edit
                              </Button>
                            )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelected(row);
                              setProgressOpen(true);
                            }}
                          >
                            Progress
                          </Button>
                          {(row.status === "draft" ||
                            row.status === "scheduled") && (
                            <Button
                              size="sm"
                              onClick={() => activateMutation.mutate(row.id)}
                              disabled={activateMutation.isPending}
                            >
                              Activate
                            </Button>
                          )}
                          {row.status !== "cancelled" &&
                            row.status !== "ended" && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => cancelMutation.mutate(row.id)}
                                disabled={cancelMutation.isPending}
                              >
                                Cancel
                              </Button>
                            )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No incentive offers yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <ListPagination
                page={page}
                limit={DEFAULT_PAGE_SIZE}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={progressOpen} onOpenChange={setProgressOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selected?.title || "Progress"}</DialogTitle>
          </DialogHeader>
          {progressQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Miss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(progressQuery.data?.data ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">
                      {p.partnerId}
                    </TableCell>
                    <TableCell>{p.status}</TableCell>
                    <TableCell className="text-xs">
                      {(p.conditionStates ?? []).length > 0
                        ? (p.conditionStates ?? [])
                            .map(
                              (s) =>
                                `${s.label}: ${s.current}/${s.target}${s.unit || ""} (${s.status})`,
                            )
                            .join(" · ")
                        : `${p.progressCurrent}/${p.progressTarget}`}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.missDetail ||
                        [p.missConditionKind, p.missReason]
                          .filter(Boolean)
                          .join(" · ") ||
                        "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {(progressQuery.data?.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-6 text-center text-muted-foreground"
                    >
                      No progress rows yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
