"use client";

import { useMemo, useState } from "react";
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
  clean_window: "No reject/timeout window",
  streak: "Consecutive deliveries",
  daily_count: "Complete N in a day",
};

export default function PartnerIncentivesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const now = useMemo(() => new Date(), []);
  const [form, setForm] = useState({
    title: "",
    body: "",
    type: "daily_count" as PartnerIncentiveType,
    rewardAmountInr: 100,
    startsAt: toLocalInput(now),
    endsAt: toLocalInput(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
    streakTarget: 10,
    dailyTarget: 10,
    requireMinDeliveries: 1,
    audience: "all" as PartnerIncentiveAudience,
    partnerIdsRaw: "",
    zoneIdsRaw: "",
    publishNow: true,
  });
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
      setForm((f) => ({ ...f, title: "", body: "" }));
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ["partner-incentives"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Create failed");
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
    const partnerIds = form.partnerIdsRaw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const zoneIds = form.zoneIdsRaw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    createMutation.mutate({
      title: form.title.trim(),
      body: form.body.trim(),
      type: form.type,
      rewardAmountInr: Number(form.rewardAmountInr),
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
      audience: form.audience,
      partnerIds: form.audience === "partners" ? partnerIds : undefined,
      zoneIds: form.audience === "zones" ? zoneIds : undefined,
      publishNow: form.publishNow,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Partner incentives
        </h1>
        <p className="text-sm text-muted-foreground">
          Create offers with live progress. Rewards auto-credit to Pocket when
          earned.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-4 w-4" />
            Create offer
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
                placeholder="Complete 10 deliveries today"
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
                placeholder="Deliver 10 orders today. Rejects are OK."
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
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
                <option value="daily_count">{typeLabels.daily_count}</option>
                <option value="streak">{typeLabels.streak}</option>
                <option value="clean_window">{typeLabels.clean_window}</option>
              </select>
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
              <Label>Ends</Label>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endsAt: e.target.value }))
                }
                required
              />
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
            <div className="md:col-span-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create offer
              </Button>
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
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.title}</TableCell>
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
        <DialogContent className="max-w-2xl">
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
                  <TableHead>Progress</TableHead>
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
                    <TableCell>
                      {p.progressCurrent}/{p.progressTarget}
                    </TableCell>
                    <TableCell>{p.missReason || "—"}</TableCell>
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
