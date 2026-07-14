"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Loader2, Plus, Trash2 } from "lucide-react";
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
  createPartnerUpdate,
  deletePartnerUpdate,
  fetchPartnerUpdates,
  type PartnerUpdateAudience,
  type PartnerUpdateCategory,
} from "@/lib/api/partnerUpdates";

const categories: PartnerUpdateCategory[] = [
  "offer",
  "bonus",
  "payment",
  "payout",
];

export default function PartnerUpdatesPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<PartnerUpdateCategory>("offer");
  const [audience, setAudience] = useState<PartnerUpdateAudience>("all");
  const [partnerIdsRaw, setPartnerIdsRaw] = useState("");
  const [zoneIdsRaw, setZoneIdsRaw] = useState("");

  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ["partner-updates"],
    queryFn: () => fetchPartnerUpdates({ limit: 80 }),
  });

  const adminRows = useMemo(
    () => data.filter((row) => row.source === "admin"),
    [data],
  );

  const createMutation = useMutation({
    mutationFn: createPartnerUpdate,
    onSuccess: async () => {
      toast.success("Update published to partners");
      setTitle("");
      setBody("");
      setPartnerIdsRaw("");
      setZoneIdsRaw("");
      setAudience("all");
      setCategory("offer");
      await queryClient.invalidateQueries({ queryKey: ["partner-updates"] });
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      toast.error(message || "Failed to publish update");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePartnerUpdate,
    onSuccess: async () => {
      toast.success("Update deleted");
      await queryClient.invalidateQueries({ queryKey: ["partner-updates"] });
    },
    onError: () => toast.error("Failed to delete update"),
  });

  const onPublish = () => {
    const partnerIds = partnerIdsRaw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const zoneIds = zoneIdsRaw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    createMutation.mutate({
      title: title.trim(),
      body: body.trim(),
      category,
      audience,
      partnerIds: audience === "partners" ? partnerIds : undefined,
      zoneIds: audience === "zones" ? zoneIds : undefined,
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-[#98E32F]" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Partner updates</h1>
          <p className="text-sm text-white/60">
            Broadcast offers, bonuses, and payment notes to the partner app Updates
            inbox.
          </p>
        </div>
      </div>

      <Card className="border-white/10 bg-[#002833] text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-4 w-4" />
            Compose update
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pu-title">Title</Label>
              <Input
                id="pu-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Weekend surge bonus"
                className="bg-[#013644] border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pu-category">Category</Label>
              <select
                id="pu-category"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as PartnerUpdateCategory)
                }
                className="w-full rounded-md border border-white/10 bg-[#013644] px-3 py-2 text-sm"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pu-body">Message</Label>
            <textarea
              id="pu-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Tell partners what is happening and what to do next."
              className="w-full rounded-md border border-white/10 bg-[#013644] px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="pu-audience">Audience</Label>
              <select
                id="pu-audience"
                value={audience}
                onChange={(e) =>
                  setAudience(e.target.value as PartnerUpdateAudience)
                }
                className="w-full rounded-md border border-white/10 bg-[#013644] px-3 py-2 text-sm"
              >
                <option value="all">All partners</option>
                <option value="zones">Selected zones</option>
                <option value="partners">Selected partners</option>
              </select>
            </div>
            {audience === "zones" && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="pu-zones">Zone IDs (comma-separated)</Label>
                <Input
                  id="pu-zones"
                  value={zoneIdsRaw}
                  onChange={(e) => setZoneIdsRaw(e.target.value)}
                  className="bg-[#013644] border-white/10"
                />
              </div>
            )}
            {audience === "partners" && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="pu-partners">
                  Partner IDs (comma-separated)
                </Label>
                <Input
                  id="pu-partners"
                  value={partnerIdsRaw}
                  onChange={(e) => setPartnerIdsRaw(e.target.value)}
                  className="bg-[#013644] border-white/10"
                />
              </div>
            )}
          </div>
          <Button
            onClick={onPublish}
            disabled={
              createMutation.isPending ||
              title.trim().length === 0 ||
              body.trim().length === 0
            }
            className="bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publishing…
              </>
            ) : (
              "Publish update"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#002833] text-white">
        <CardHeader>
          <CardTitle className="text-lg">Recent broadcasts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-white/70">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : isError ? (
            <p className="text-red-300">
              {(error as Error)?.message || "Failed to load updates"}
            </p>
          ) : adminRows.length === 0 ? (
            <p className="text-white/60">No admin updates yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/70">Title</TableHead>
                  <TableHead className="text-white/70">Category</TableHead>
                  <TableHead className="text-white/70">Audience</TableHead>
                  <TableHead className="text-white/70">Published</TableHead>
                  <TableHead className="text-right text-white/70">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminRows.map((row) => (
                  <TableRow key={row.id} className="border-white/10">
                    <TableCell>
                      <div className="font-medium">{row.title}</div>
                      <div className="line-clamp-2 text-xs text-white/50">
                        {row.body}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {row.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{row.audience}</TableCell>
                    <TableCell className="text-sm text-white/60">
                      {new Date(row.publishedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (
                            confirm("Delete this update from partner inboxes?")
                          ) {
                            deleteMutation.mutate(row.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-300" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
