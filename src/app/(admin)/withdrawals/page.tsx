"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchWithdrawals,
  updateWithdrawalStatus,
  type AdminWithdrawal,
  type WithdrawalStatus,
} from "@/lib/api/withdrawals";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, Search } from "lucide-react";

const STATUS_FILTERS: Array<WithdrawalStatus | "all"> = [
  "all",
  "pending",
  "approved",
  "rejected",
  "paid",
];

function statusBadge(status: WithdrawalStatus) {
  const map: Record<WithdrawalStatus, string> = {
    pending: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    approved: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    rejected: "bg-red-500/20 text-red-300 border-red-500/40",
    paid: "bg-[#98E32F]/20 text-[#98E32F] border-[#98E32F]/40",
  };
  return (
    <Badge variant="outline" className={map[status]}>
      {status}
    </Badge>
  );
}

function maskAccount(num?: string) {
  if (!num) return "—";
  const clean = num.replace(/\s/g, "");
  if (clean.length <= 4) return clean;
  return `•••• ${clean.slice(-4)}`;
}

export default function WithdrawalsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<WithdrawalStatus | "all">("pending");
  const [search, setSearch] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    status: WithdrawalStatus;
  } | null>(null);

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-withdrawals", status, search],
    queryFn: () =>
      fetchWithdrawals({
        status: status === "all" ? undefined : status,
        search: search.trim() || undefined,
      }),
  });

  const mutation = useMutation({
    mutationFn: ({
      id,
      nextStatus,
      note,
    }: {
      id: string;
      nextStatus: WithdrawalStatus;
      note?: string;
    }) => updateWithdrawalStatus(id, { status: nextStatus, notes: note }),
    onSuccess: (_, vars) => {
      toast.success(`Marked as ${vars.nextStatus}`);
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      setNotesOpen(false);
      setPendingAction(null);
      setNotes("");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to update withdrawal");
    },
  });

  const rows = useMemo(() => data as AdminWithdrawal[], [data]);

  function askStatus(id: string, next: WithdrawalStatus) {
    setPendingAction({ id, status: next });
    setNotes("");
    setNotesOpen(true);
  }

  function confirmStatus() {
    if (!pendingAction) return;
    mutation.mutate({
      id: pendingAction.id,
      nextStatus: pendingAction.status,
      note: notes.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Withdrawals</h1>
          <p className="text-sm text-white/60">
            Verify restaurant owner withdraw requests and mark them paid after
            transfer.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-white/20 text-white"
          onClick={() => refetch()}
        >
          Refresh
        </Button>
      </div>

      <Card className="bg-[#002833] border-white/10">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={status === s ? "default" : "outline"}
                  className={
                    status === s
                      ? "bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90"
                      : "border-white/20 text-white"
                  }
                  onClick={() => setStatus(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search restaurant / owner"
                className="pl-9 bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/70">Restaurant</TableHead>
                  <TableHead className="text-white/70">Owner</TableHead>
                  <TableHead className="text-white/70">Bank</TableHead>
                  <TableHead className="text-white/70">Amount</TableHead>
                  <TableHead className="text-white/70">Mode</TableHead>
                  <TableHead className="text-white/70">Status</TableHead>
                  <TableHead className="text-white/70">Requested</TableHead>
                  <TableHead className="text-white/70 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-white/50 py-10">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-white/50 py-10">
                      No withdrawal requests
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((w) => (
                    <TableRow key={w._id} className="border-white/10">
                      <TableCell className="text-white font-medium">
                        {w.restaurant?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-white/80">
                        <div>{w.owner?.name ?? "—"}</div>
                        <div className="text-xs text-white/45">{w.owner?.email}</div>
                      </TableCell>
                      <TableCell className="text-white/80 text-sm">
                        <div>{w.bankAccount?.bankName ?? "—"}</div>
                        <div className="text-xs text-white/45">
                          {w.bankAccount?.accountHolderName} ·{" "}
                          {maskAccount(w.bankAccount?.accountNumber)}
                        </div>
                        <div className="text-xs text-white/45">
                          {w.bankAccount?.ifscCode}
                        </div>
                      </TableCell>
                      <TableCell className="text-[#98E32F] font-semibold">
                        ₹{Number(w.amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-white/70 text-sm">
                        {w.restaurant?.payoutMode ?? "manual"}
                      </TableCell>
                      <TableCell>{statusBadge(w.status)}</TableCell>
                      <TableCell className="text-white/60 text-sm">
                        {w.requestedAt
                          ? new Date(w.requestedAt).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-white/70 hover:text-white"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[#013644] border-white/10 text-white">
                            <DropdownMenuLabel>Update status</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
                            {w.status === "pending" && (
                              <>
                                <DropdownMenuItem onClick={() => askStatus(w._id, "approved")}>
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => askStatus(w._id, "rejected")}>
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {(w.status === "pending" || w.status === "approved") && (
                              <DropdownMenuItem onClick={() => askStatus(w._id, "paid")}>
                                Mark paid
                              </DropdownMenuItem>
                            )}
                            {w.status === "paid" && (
                              <DropdownMenuItem disabled>Already paid</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="bg-[#002833] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>
              Mark as {pendingAction?.status ?? "…"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="UTR / reason / reference"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-white/20 text-white"
              onClick={() => setNotesOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90"
              disabled={mutation.isPending}
              onClick={confirmStatus}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
