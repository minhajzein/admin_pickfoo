"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Loader2, Plus, Send, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  previewManualPush,
  sendManualPush,
  updatePushCopy,
  updateReengageSettings,
  type ManualPushAudience,
  type ManualPushTarget,
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

const MANUAL_AUDIENCES: { value: ManualPushAudience; label: string }[] = [
  { value: "all", label: "All customers" },
  { value: "never_ordered", label: "Never ordered" },
  { value: "ordered", label: "Ordered at least once" },
  { value: "lapsed", label: "Lapsed (no order in N days)" },
  { value: "specific", label: "Specific customers (phone / email)" },
];

const TITLE_MAX = 80;
const BODY_MAX = 180;

function ManualPushCard({ defaultLapsedDays }: { defaultLapsedDays: number }) {
  const queryClient = useQueryClient();
  const [audience, setAudience] = useState<ManualPushAudience>("all");
  const [lapsedDays, setLapsedDays] = useState<number | "">("");
  const [identifiers, setIdentifiers] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<{ recipients: number; devices: number } | null>(null);

  const target = (): ManualPushTarget => ({
    audience,
    lapsedAfterDays: audience === "lapsed" ? Number(lapsedDays || defaultLapsedDays) : undefined,
    identifiers:
      audience === "specific"
        ? identifiers.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
        : undefined,
  });

  const previewMut = useMutation({
    mutationFn: () => previewManualPush(target()),
    onSuccess: setPreview,
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to count recipients")),
  });

  const sendMut = useMutation({
    mutationFn: () => sendManualPush({ ...target(), title: title.trim(), body: body.trim() }),
    onSuccess: async (res) => {
      toast.success(
        `Delivered to ${res.delivered} of ${res.targeted} customers` +
          (res.failed ? ` (${res.failed} device failures)` : ""),
      );
      setTitle("");
      setBody("");
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ["reengage-analytics"] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to send push")),
  });

  const resetPreview = () => setPreview(null);
  const canSend = title.trim() !== "" && body.trim() !== "" && !sendMut.isPending;

  const onSend = () => {
    const who = MANUAL_AUDIENCES.find((a) => a.value === audience)?.label ?? audience;
    const count = preview ? ` (${preview.recipients} customers)` : "";
    if (!window.confirm(`Send "${title.trim()}" to ${who}${count} now?`)) return;
    sendMut.mutate();
  };

  return (
    <Card className="border-white/10 bg-[#013644]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Send size={18} /> Send push manually
        </CardTitle>
        <p className="text-sm text-white/60">
          Sent immediately, ignoring slots and quiet hours. Counts toward each customer&apos;s
          daily cap.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="text-white/70">Audience</Label>
          <select
            className="h-10 w-full rounded-md bg-black/20 px-3 text-white"
            value={audience}
            onChange={(e) => {
              setAudience(e.target.value as ManualPushAudience);
              resetPreview();
            }}
          >
            {MANUAL_AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        {audience === "lapsed" ? (
          <div>
            <Label className="text-white/70">No order in last (days)</Label>
            <Input
              type="number"
              min={1}
              placeholder={String(defaultLapsedDays)}
              value={lapsedDays}
              onChange={(e) => {
                setLapsedDays(e.target.value === "" ? "" : Number(e.target.value));
                resetPreview();
              }}
            />
          </div>
        ) : (
          <div className="hidden md:block" />
        )}
        {audience === "specific" ? (
          <div className="md:col-span-2">
            <Label className="text-white/70">Phone numbers or emails</Label>
            <Textarea
              rows={3}
              placeholder="9876543210, someone@example.com"
              value={identifiers}
              onChange={(e) => {
                setIdentifiers(e.target.value);
                resetPreview();
              }}
            />
          </div>
        ) : null}
        <div className="md:col-span-2">
          <Label className="text-white/70">
            Title ({title.length}/{TITLE_MAX})
          </Label>
          <Input
            maxLength={TITLE_MAX}
            placeholder="Hungry? 🍕"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Label className="text-white/70">
            Message ({body.length}/{BODY_MAX})
          </Label>
          <Textarea
            rows={3}
            maxLength={BODY_MAX}
            placeholder="Your favourites are just a tap away."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button
            variant="outline"
            onClick={() => previewMut.mutate()}
            disabled={previewMut.isPending}
          >
            {previewMut.isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Users size={16} />
            )}
            Check recipients
          </Button>
          {preview ? (
            <span className="text-sm text-white/80">
              {preview.recipients} customers · {preview.devices} devices
            </span>
          ) : null}
          <Button
            onClick={onSend}
            disabled={!canSend}
            className="ml-auto bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90"
          >
            {sendMut.isPending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            Send now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

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

      <ManualPushCard defaultLapsedDays={settingsQuery.data?.lapsedAfterDays ?? 7} />

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
