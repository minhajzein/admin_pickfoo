"use client";

import { useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, Ticket } from "lucide-react";
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
  createCoupon,
  deleteCoupon,
  fetchCoupons,
  searchCouponOffers,
  updateCoupon,
  type AdminCoupon,
  type CouponKind,
  type CouponOfferOption,
} from "@/lib/api/coupons";
import { ListPagination } from "@/components/ui/list-pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

type FormState = {
  code: string;
  kind: CouponKind;
  title: string;
  description: string;
  offerId: string;
  offerTitle: string;
  usageLimit: number;
  usagePerUser: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  code: "",
  kind: "coupon",
  title: "",
  description: "",
  offerId: "",
  offerTitle: "",
  usageLimit: 0,
  usagePerUser: 0,
  startsAt: "",
  endsAt: "",
  isActive: true,
});

function formFromRow(row: AdminCoupon): FormState {
  return {
    ...emptyForm(),
    code: row.code,
    kind: row.kind,
    title: row.title,
    description: row.description,
    offerId: row.offerId,
    usageLimit: row.usageLimit,
    usagePerUser: row.usagePerUser,
    startsAt: row.startsAt ? row.startsAt.slice(0, 16) : "",
    endsAt: row.endsAt ? row.endsAt.slice(0, 16) : "",
    isActive: row.isActive,
  };
}

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [kindFilter, setKindFilter] = useState<"" | CouponKind>("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [offerSearch, setOfferSearch] = useState("");
  const [offerOptions, setOfferOptions] = useState<CouponOfferOption[]>([]);
  const [searchingOffers, setSearchingOffers] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-coupons", page, kindFilter],
    queryFn: () =>
      fetchCoupons({
        page,
        limit: DEFAULT_PAGE_SIZE,
        kind: kindFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.code.trim()) throw new Error("Code is required");
      if (!form.title.trim()) throw new Error("Title is required");
      if (!form.offerId) throw new Error("Select a linked offer");
      const payload = {
        code: form.code.trim().toUpperCase(),
        kind: form.kind,
        title: form.title.trim(),
        description: form.description.trim(),
        offerId: form.offerId,
        isActive: form.isActive,
        usageLimit: form.usageLimit,
        usagePerUser: form.usagePerUser,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      };
      if (editingId) return updateCoupon(editingId, payload);
      return createCoupon(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "Updated" : "Created");
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm());
    },
    onError: (e: Error) => toast.error(e.message || "Save failed"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCoupon,
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (e: Error) => toast.error(e.message || "Delete failed"),
  });

  async function runOfferSearch() {
    setSearchingOffers(true);
    try {
      setOfferOptions(await searchCouponOffers(offerSearch));
    } finally {
      setSearchingOffers(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(row: AdminCoupon) {
    setEditingId(row.id);
    setForm(formFromRow(row));
    setOpen(true);
  }

  const dialogTitle = useMemo(
    () => (editingId ? "Edit code" : "Create coupon / voucher"),
    [editingId],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Coupons & vouchers</h1>
          <p className="text-sm text-white/60">
            Codes linked to customer offers — redeemed at cart checkout.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-[#98E32F] text-[#013644]">
          <Plus className="mr-2 h-4 w-4" /> New code
        </Button>
      </div>

      <div className="flex gap-2">
        {(["", "coupon", "voucher"] as const).map((k) => (
          <Button
            key={k || "all"}
            size="sm"
            variant={kindFilter === k ? "default" : "outline"}
            onClick={() => {
              setKindFilter(k);
              setPage(1);
            }}
          >
            {k === "" ? "All" : k === "coupon" ? "Coupons" : "Vouchers"}
          </Button>
        ))}
      </div>

      <Card className="border-white/10 bg-[#013644]/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Ticket className="h-5 w-5 text-[#98E32F]" /> Codes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#98E32F]" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Offer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono font-semibold text-[#98E32F]">
                        {row.code}
                      </TableCell>
                      <TableCell className="capitalize text-white/80">
                        {row.kind}
                      </TableCell>
                      <TableCell className="text-white">{row.title}</TableCell>
                      <TableCell className="text-xs text-white/50">
                        {row.offerId}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.isActive ? "default" : "secondary"}>
                          {row.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMut.mutate(row.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data && (
                <ListPagination
                  page={page}
                  total={data.total}
                  totalPages={data.totalPages}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#013644] text-white">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                  placeholder="SAVE50"
                />
              </div>
              <div className="grid gap-2">
                <Label>Kind</Label>
                <select
                  className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm"
                  value={form.kind}
                  onChange={(e) =>
                    setForm({ ...form, kind: e.target.value as CouponKind })
                  }
                >
                  <option className="bg-[#013644]" value="coupon">
                    Coupon
                  </option>
                  <option className="bg-[#013644]" value="voucher">
                    Voucher
                  </option>
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2 rounded-md border border-white/10 p-3">
              <Label>Linked customer offer</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search offers"
                  value={offerSearch}
                  onChange={(e) => setOfferSearch(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={runOfferSearch}>
                  {searchingOffers ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {offerOptions.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`rounded border px-2 py-1 text-xs ${
                      form.offerId === o.id
                        ? "border-[#98E32F] bg-[#98E32F] text-[#013644]"
                        : "border-white/20 text-white"
                    }`}
                    onClick={() =>
                      setForm({
                        ...form,
                        offerId: o.id,
                        offerTitle: o.title,
                        title: form.title || o.title,
                      })
                    }
                  >
                    {o.title} · {o.type}
                  </button>
                ))}
              </div>
              {form.offerId ? (
                <p className="text-xs text-white/50">
                  Selected: {form.offerTitle || form.offerId}
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Usage limit (0 = unlimited)</Label>
                <Input
                  type="number"
                  value={form.usageLimit}
                  onChange={(e) =>
                    setForm({ ...form, usageLimit: Number(e.target.value) })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Per user limit</Label>
                <Input
                  type="number"
                  value={form.usagePerUser}
                  onChange={(e) =>
                    setForm({ ...form, usagePerUser: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
              />
              Active
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-[#98E32F] text-[#013644]"
                disabled={saveMut.isPending}
                onClick={() => saveMut.mutate()}
              >
                {saveMut.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
