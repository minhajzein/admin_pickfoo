"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createGig,
  fetchGigBookings,
  fetchGigs,
  updateGig,
} from "@/lib/api/gigs";
import type { AdminGig, AdminGigBooking } from "@/types/models";
import { Loader2 } from "lucide-react";

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
};

const toLocalInputDate = (date = new Date()): string => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export default function GigsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "Morning Rush Gig",
    subtitle: "Book gigs to deliver orders",
    dayKey: toLocalInputDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    startTime: "06:00",
    endTime: "12:00",
    payoutPerOrder: 70,
    maxOrders: 30,
  });
  const [selectedGig, setSelectedGig] = useState<AdminGig | null>(null);
  const [bookings, setBookings] = useState<AdminGigBooking[]>([]);
  const [openBookings, setOpenBookings] = useState(false);

  const { data: gigs = [], isLoading } = useQuery({
    queryKey: ["admin-gigs"],
    queryFn: () => fetchGigs({ fromDayKey: toLocalInputDate() }),
  });

  const createMutation = useMutation({
    mutationFn: createGig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gigs"] });
      toast.success("Gig created");
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message || "Failed to create gig"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminGig["status"] }) =>
      updateGig(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gigs"] });
      toast.success("Gig updated");
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message || "Failed to update gig"),
  });

  const stats = useMemo(() => {
    const open = gigs.filter((g) => g.status === "open").length;
    const full = gigs.filter((g) => g.slotsLeft <= 0).length;
    const totalBooked = gigs.reduce((sum, g) => sum + g.bookedCount, 0);
    return { open, full, totalBooked };
  }, [gigs]);

  const submitCreate = () => {
    const startMinute = toMinutes(form.startTime);
    const endMinute = toMinutes(form.endTime);
    if (endMinute <= startMinute) {
      toast.error("End time must be after start time");
      return;
    }
    createMutation.mutate({
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      dayKey: form.dayKey,
      startMinute,
      endMinute,
      payoutPerOrder: Number(form.payoutPerOrder),
      maxOrders: Number(form.maxOrders),
    });
  };

  const openBookingDialog = async (gig: AdminGig) => {
    try {
      const result = await fetchGigBookings(gig.id);
      setSelectedGig(result.gig);
      setBookings(result.bookings);
      setOpenBookings(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to load bookings");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Gigs</h2>
        <p className="text-sm text-white/50">
          Create and manage shift gigs for partner booking and dispatch.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Open gigs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.open}</CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Full gigs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.full}</CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">
              Total booked slots
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {stats.totalBooked}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/5 bg-[#002833] text-white">
        <CardHeader>
          <CardTitle className="text-base">Create gig</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              className="border-white/10 bg-[#013644] text-white"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Gig title"
            />
            <Input
              className="border-white/10 bg-[#013644] text-white"
              value={form.subtitle}
              onChange={(e) =>
                setForm((p) => ({ ...p, subtitle: e.target.value }))
              }
              placeholder="Gig subtitle"
            />
            <Input
              type="date"
              className="border-white/10 bg-[#013644] text-white"
              value={form.dayKey}
              onChange={(e) => setForm((p) => ({ ...p, dayKey: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="time"
                className="border-white/10 bg-[#013644] text-white"
                value={form.startTime}
                onChange={(e) =>
                  setForm((p) => ({ ...p, startTime: e.target.value }))
                }
              />
              <Input
                type="time"
                className="border-white/10 bg-[#013644] text-white"
                value={form.endTime}
                onChange={(e) =>
                  setForm((p) => ({ ...p, endTime: e.target.value }))
                }
              />
            </div>
            <Input
              type="number"
              min={0}
              className="border-white/10 bg-[#013644] text-white"
              value={form.payoutPerOrder}
              onChange={(e) =>
                setForm((p) => ({ ...p, payoutPerOrder: Number(e.target.value) }))
              }
              placeholder="Payout per order"
            />
            <Input
              type="number"
              min={1}
              className="border-white/10 bg-[#013644] text-white"
              value={form.maxOrders}
              onChange={(e) =>
                setForm((p) => ({ ...p, maxOrders: Number(e.target.value) }))
              }
              placeholder="Booking capacity"
            />
          </div>
          <div className="mt-4">
            <Button
              className="bg-[#98E32F] text-[#013644] hover:bg-[#86c926]"
              onClick={submitCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create gig
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-white/5 bg-[#002833] text-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/60">Shift</TableHead>
                <TableHead className="text-white/60">Window</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Slots</TableHead>
                <TableHead className="text-white/60">Payout</TableHead>
                <TableHead className="text-right text-white/60">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#98E32F]" />
                  </TableCell>
                </TableRow>
              ) : gigs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-white/40">
                    No gigs found
                  </TableCell>
                </TableRow>
              ) : (
                gigs.map((gig) => (
                  <TableRow
                    key={gig.id}
                    className="border-white/5 hover:bg-white/5"
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{gig.title}</span>
                        <span className="text-xs text-white/40">
                          {gig.dayKey}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-white/80">{gig.timeLabel}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-white/10 text-white/80"
                      >
                        {gig.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white/80">
                      {gig.bookedCount}/{gig.maxOrders} (left {gig.slotsLeft})
                    </TableCell>
                    <TableCell className="text-white/80">
                      ₹{gig.payoutPerOrder}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#98E32F]/40 text-[#98E32F] hover:bg-[#98E32F]/10"
                          onClick={() => openBookingDialog(gig)}
                        >
                          Bookings
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/20 text-white hover:bg-white/10"
                          disabled={updateMutation.isPending}
                          onClick={() =>
                            updateMutation.mutate({
                              id: gig.id,
                              status:
                                gig.status === "cancelled" ? "open" : "cancelled",
                            })
                          }
                        >
                          {gig.status === "cancelled" ? "Re-open" : "Cancel"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={openBookings} onOpenChange={setOpenBookings}>
        <DialogContent className="border-white/5 bg-[#002833] text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedGig?.title ?? "Gig"} — bookings
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-white/60">Partner</TableHead>
                  <TableHead className="text-white/60">Phone</TableHead>
                  <TableHead className="text-white/60">Status</TableHead>
                  <TableHead className="text-right text-white/60">
                    Earnings
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-white/40"
                    >
                      No bookings yet
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking) => (
                    <TableRow
                      key={`${booking.partnerId}-${booking.bookedAt}`}
                      className="border-white/5 hover:bg-white/5"
                    >
                      <TableCell>{booking.partnerName}</TableCell>
                      <TableCell className="text-white/70">
                        {booking.phone}
                      </TableCell>
                      <TableCell className="text-white/70">
                        {booking.status}
                      </TableCell>
                      <TableCell className="text-right text-white/80">
                        ₹{booking.earnings}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
