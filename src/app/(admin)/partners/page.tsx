"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchPartners, updatePartnerZones } from "@/lib/api/partners";
import { fetchZones } from "@/lib/api/zones";
import type { Partner } from "@/types/models";
import { Loader2, MapPin, Search } from "lucide-react";

export default function PartnersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editPartner, setEditPartner] = useState<Partner | null>(null);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partners", search],
    queryFn: () => fetchPartners({ search: search || undefined }),
  });

  const { data: zoneOptions = [] } = useQuery({
    queryKey: ["zones", "wayanad"],
    queryFn: () =>
      fetchZones({ district: "Wayanad", includeInactive: false }),
  });

  const zonesMutation = useMutation({
    mutationFn: ({
      partnerId,
      zoneIds,
    }: {
      partnerId: string;
      zoneIds: string[];
    }) => updatePartnerZones(partnerId, zoneIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast.success("Partner zones updated");
      setEditPartner(null);
    },
    onError: () => toast.error("Failed to update zones"),
  });

  const openZonesDialog = (p: Partner) => {
    setEditPartner(p);
    setSelectedZoneIds(
      (p.zones ?? []).map((z) => z._id).filter(Boolean) as string[],
    );
  };

  const toggleZone = (id: string) => {
    setSelectedZoneIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Partners</h2>
          <p className="text-sm text-white/50">
            Delivery partners and their Wayanad zones
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search name, email, phone..."
            className="border-white/10 bg-[#002833] pl-9 text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="overflow-hidden border-white/5 bg-[#002833] text-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/60">Partner</TableHead>
                <TableHead className="text-white/60">Phone</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Zones</TableHead>
                <TableHead className="text-right text-white/60">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#98E32F]" />
                  </TableCell>
                </TableRow>
              ) : partners.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-white/40"
                  >
                    No partners found
                  </TableCell>
                </TableRow>
              ) : (
                partners.map((p) => (
                  <TableRow
                    key={p._id}
                    className="border-white/5 hover:bg-white/5"
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{p.fullName}</span>
                        <span className="text-xs text-white/40">{p.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-white/80">{p.phone}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-white/10 text-white/80"
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="flex flex-wrap gap-1">
                        {(p.zones ?? []).length === 0 ? (
                          <span className="text-xs text-white/40">None</span>
                        ) : (
                          p.zones!.map((z) => (
                            <span
                              key={z._id}
                              className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70"
                            >
                              {z.code}
                            </span>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#98E32F]/40 text-[#98E32F] hover:bg-[#98E32F]/10"
                        onClick={() => openZonesDialog(p)}
                      >
                        <MapPin className="mr-1 h-3.5 w-3.5" />
                        Zones
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editPartner} onOpenChange={() => setEditPartner(null)}>
        <DialogContent className="border-white/5 bg-[#002833] text-white">
          <DialogHeader>
            <DialogTitle>Edit delivery zones</DialogTitle>
            <DialogDescription className="text-white/50">
              {editPartner?.fullName} — select all zones this partner can serve.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto py-2">
            {zoneOptions.length === 0 ? (
              <p className="text-sm text-white/40">
                Create zones under Zones first.
              </p>
            ) : (
              zoneOptions.map((z) => (
                <label
                  key={z._id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/5 px-3 py-2 hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={selectedZoneIds.includes(z._id)}
                    onChange={() => toggleZone(z._id)}
                    className="accent-[#98E32F]"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{z.name}</span>
                    <span className="text-xs text-white/40">{z.code}</span>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5"
              onClick={() => setEditPartner(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#98E32F] text-[#013644] hover:bg-[#86c926]"
              disabled={!editPartner?._id || zonesMutation.isPending}
              onClick={() => {
                if (!editPartner?._id) return;
                zonesMutation.mutate({
                  partnerId: editPartner._id,
                  zoneIds: selectedZoneIds,
                });
              }}
            >
              {zonesMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save zones
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
