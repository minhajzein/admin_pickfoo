"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  createPushCopy,
  fetchPushCopy,
  fetchReengageAnalytics,
  fetchReengageSettings,
  updatePushCopy,
  updateReengageSettings,
  type PushCopyRow,
} from "@/lib/api/reengage";
import { getApiErrorMessage } from "@/lib/axios";
import { ListPagination } from "@/components/ui/list-pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

const CATEGORIES = [
  "meal_breakfast",
  "meal_lunch",
  "meal_tea",
  "meal_dinner",
  "restaurant_open",
  "winback_never_ordered",
  "winback_lapsed",
];

export default function ReengagePage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [draft, setDraft] = useState({
    key: "",
    category: "meal_lunch",
    variantGroup: "A",
    titleTemplate: "",
    bodyTemplate: "",
  });

  const copyQuery = useQuery({
    queryKey: ["reengage-copy", page, category],
    queryFn: () =>
      fetchPushCopy({
        page,
        limit: DEFAULT_PAGE_SIZE,
        category: category || undefined,
      }),
  });
  const settingsQuery = useQuery({
    queryKey: ["reengage-settings"],
    queryFn: fetchReengageSettings,
  });
  const analyticsQuery = useQuery({
    queryKey: ["reengage-analytics"],
    queryFn: fetchReengageAnalytics,
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updatePushCopy(id, { isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reengage-copy"] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update copy")),
  });

  const createMut = useMutation({
    mutationFn: () => createPushCopy(draft),
    onSuccess: async () => {
      toast.success("Copy added");
      setDraft({
        key: "",
        category: "meal_lunch",
        variantGroup: "A",
        titleTemplate: "",
        bodyTemplate: "",
      });
      await queryClient.invalidateQueries({ queryKey: ["reengage-copy"] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to add copy")),
  });

  const saveSettingsMut = useMutation({
    mutationFn: () =>
      updateReengageSettings({
        enabled: settingsQuery.data?.enabled,
        maxPerDay: settingsQuery.data?.maxPerDay,
        maxPerDayWithEvent: settingsQuery.data?.maxPerDayWithEvent,
        lapsedAfterDays: settingsQuery.data?.lapsedAfterDays,
        nearbyKm: settingsQuery.data?.nearbyKm,
      }),
    onSuccess: () => toast.success("Settings saved"),
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to save settings")),
  });

  const rows = copyQuery.data?.data ?? [];
  const meta = copyQuery.data;
  const analytics = analyticsQuery.data ?? [];

  const totals = useMemo(() => {
    return analytics.reduce(
      (acc, row) => {
        acc.sent += row.sent;
        acc.opened += row.opened;
        acc.converted += row.converted;
        return acc;
      },
      { sent: 0, opened: 0, converted: 0 },
    );
  }, [analytics]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Re-engagement pushes</h1>
        <p className="mt-1 text-sm text-white/60">
          One best-fit notification per user per day, using real menu items for the current meal
          slot. Placeholders: {"{dish}"} {"{restaurant}"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-white/10 bg-[#013644]">
          <CardHeader>
            <CardTitle className="text-sm text-white/70">Sent (14d)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">{totals.sent}</CardContent>
        </Card>
        <Card className="border-white/10 bg-[#013644]">
          <CardHeader>
            <CardTitle className="text-sm text-white/70">Opened</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">{totals.opened}</CardContent>
        </Card>
        <Card className="border-white/10 bg-[#013644]">
          <CardHeader>
            <CardTitle className="text-sm text-white/70">Converted to order</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-white">{totals.converted}</CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-[#013644]">
        <CardHeader>
          <CardTitle className="text-white">Caps & timing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={Boolean(settingsQuery.data?.enabled)}
              onChange={(e) =>
                queryClient.setQueryData(["reengage-settings"], {
                  ...settingsQuery.data,
                  enabled: e.target.checked,
                })
              }
            />
            Enabled
          </label>
          <div>
            <Label className="text-white/70">Max / day</Label>
            <Input
              type="number"
              value={settingsQuery.data?.maxPerDay ?? 1}
              onChange={(e) =>
                queryClient.setQueryData(["reengage-settings"], {
                  ...settingsQuery.data,
                  maxPerDay: Number(e.target.value),
                })
              }
            />
          </div>
          <div>
            <Label className="text-white/70">Max / day with open event</Label>
            <Input
              type="number"
              value={settingsQuery.data?.maxPerDayWithEvent ?? 2}
              onChange={(e) =>
                queryClient.setQueryData(["reengage-settings"], {
                  ...settingsQuery.data,
                  maxPerDayWithEvent: Number(e.target.value),
                })
              }
            />
          </div>
          <div>
            <Label className="text-white/70">Lapsed after (days)</Label>
            <Input
              type="number"
              value={settingsQuery.data?.lapsedAfterDays ?? 7}
              onChange={(e) =>
                queryClient.setQueryData(["reengage-settings"], {
                  ...settingsQuery.data,
                  lapsedAfterDays: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => saveSettingsMut.mutate()}
              disabled={saveSettingsMut.isPending}
              className="bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90"
            >
              {saveSettingsMut.isPending ? <Loader2 className="animate-spin" size={16} /> : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#013644]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Plus size={18} /> Add copy
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="key (unique)"
            value={draft.key}
            onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
          />
          <select
            className="h-10 rounded-md bg-black/20 px-3 text-white"
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md bg-black/20 px-3 text-white"
            value={draft.variantGroup}
            onChange={(e) => setDraft((d) => ({ ...d, variantGroup: e.target.value }))}
          >
            <option value="A">Variant A</option>
            <option value="B">Variant B</option>
          </select>
          <Input
            placeholder="Title template"
            value={draft.titleTemplate}
            onChange={(e) => setDraft((d) => ({ ...d, titleTemplate: e.target.value }))}
          />
          <Input
            className="md:col-span-2"
            placeholder="Body template"
            value={draft.bodyTemplate}
            onChange={(e) => setDraft((d) => ({ ...d, bodyTemplate: e.target.value }))}
          />
          <Button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90"
          >
            Add to copy bank
          </Button>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#013644]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white">
            <Bell size={18} /> Copy bank
          </CardTitle>
          <select
            className="h-9 rounded-md bg-black/20 px-3 text-sm text-white"
            value={category}
            onChange={(e) => {
              setPage(1);
              setCategory(e.target.value);
            }}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </CardHeader>
        <CardContent>
          {copyQuery.isLoading ? (
            <Loader2 className="animate-spin text-white" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>AB</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Body</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: PushCopyRow) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs text-white/80">{row.key}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.category}</Badge>
                    </TableCell>
                    <TableCell className="text-white">{row.variantGroup}</TableCell>
                    <TableCell className="text-white">{row.titleTemplate}</TableCell>
                    <TableCell className="max-w-xs text-white/80">{row.bodyTemplate}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toggleMut.mutate({ id: row.id, isActive: !row.isActive })
                        }
                      >
                        {row.isActive ? "On" : "Off"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {meta ? (
            <div className="mt-4">
              <ListPagination
                page={meta.page}
                total={meta.total}
                totalPages={meta.totalPages}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#013644]">
        <CardHeader>
          <CardTitle className="text-white">Copy performance (14d)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variant</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>AB</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Converted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.map((row) => (
                <TableRow key={`${row.variantKey}-${row.variantGroup}`}>
                  <TableCell className="font-mono text-xs text-white">{row.variantKey}</TableCell>
                  <TableCell className="text-white/80">{row.category}</TableCell>
                  <TableCell className="text-white">{row.variantGroup}</TableCell>
                  <TableCell className="text-white">{row.sent}</TableCell>
                  <TableCell className="text-white">{row.opened}</TableCell>
                  <TableCell className="text-white">{row.converted}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
