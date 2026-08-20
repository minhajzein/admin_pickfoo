"use client";

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageIcon, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteBanner,
  fetchBanners,
  type AdminHomeBanner,
  type HomeBannerLinkType,
} from "@/lib/api/banners";
import { ListPagination } from "@/components/ui/list-pagination";

/**
 * Real problem: promo banners are multi‑MB full‑bleed images.
 * Decoding them in the list freezes the main thread (INP / hang).
 * List uses a lightweight placeholder; the dialog loads one preview.
 */
const loadBannerEditor = () =>
  import("@/components/banners/BannerEditorCard").then(
    (m) => m.BannerEditorCard,
  );

const BannerEditorCard = dynamic(loadBannerEditor, {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-12 text-white/40">
      <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
    </div>
  ),
});

/** Yield past the next paint so click INP isn't charged for dialog work. */
function afterNextPaint(fn: () => void) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(fn);
  });
}

const BANNERS_PAGE_SIZE = 10;

const linkTypeLabels: Record<HomeBannerLinkType, string> = {
  none: "No link",
  restaurant: "Restaurant",
  dish: "Single dish",
  dishes: "Multiple dishes",
  offer: "Customer offer",
};

function linkSummary(banner: AdminHomeBanner) {
  if (banner.linkType === "restaurant")
    return `Restaurant: ${banner.restaurantId}`;
  if (banner.linkType === "dish") return `Dish: ${banner.menuItemId}`;
  if (banner.linkType === "dishes")
    return `${banner.menuItemIds.length} dishes`;
  if (banner.linkType === "offer") return `Offer: ${banner.offerId}`;
  return "—";
}

function formatSchedule(banner: AdminHomeBanner): string {
  if (!banner.startsAt && !banner.endsAt) return "Always";
  const parts: string[] = [];
  if (banner.startsAt) {
    parts.push(`From ${new Date(banner.startsAt).toLocaleString()}`);
  }
  if (banner.endsAt) {
    parts.push(`To ${new Date(banner.endsAt).toLocaleString()}`);
  }
  return parts.join(" · ");
}

const BannerRow = memo(function BannerRow({
  banner,
  deletePending,
  onEdit,
  onDelete,
}: {
  banner: AdminHomeBanner;
  deletePending: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex h-14 w-24 items-center justify-center rounded border border-white/10 bg-black/30 text-[#98E32F]/70">
          <ImageIcon className="h-5 w-5" />
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">
          {banner.title?.trim() || (
            <span className="italic text-white/40">No title</span>
          )}
        </div>
        {banner.subtitle?.trim() ? (
          <div className="text-xs text-white/50">{banner.subtitle}</div>
        ) : null}
      </TableCell>
      <TableCell className="text-xs">
        <div>{linkTypeLabels[banner.linkType]}</div>
        <div className="text-white/50">{linkSummary(banner)}</div>
      </TableCell>
      <TableCell className="text-xs text-white/60">
        {formatSchedule(banner)}
      </TableCell>
      <TableCell>{banner.sortOrder}</TableCell>
      <TableCell>
        <Badge variant={banner.isActive ? "default" : "outline"}>
          {banner.isActive ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onEdit(banner.id)}
            aria-label={`Edit ${banner.title?.trim() || "banner"}`}
          >
            <Pencil className="mr-1 h-4 w-4" />
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-red-400 hover:text-red-300"
            disabled={deletePending}
            onClick={() => onDelete(banner.id)}
            aria-label={`Delete ${banner.title?.trim() || "banner"}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

const BannersListCard = memo(function BannersListCard({
  banners,
  isLoading,
  page,
  total,
  totalPages,
  deletePending,
  onPageChange,
  onEdit,
  onDelete,
}: {
  banners: AdminHomeBanner[];
  isLoading: boolean;
  page: number;
  total: number;
  totalPages: number;
  deletePending: boolean;
  onPageChange: (page: number) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="border-white/10 bg-[#002833]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          All banners
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
          </div>
        ) : banners.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/50">
            No banners yet. Click{" "}
            <strong className="text-white/80">Add banner</strong> to create one.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Preview</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banners.map((banner) => (
                <BannerRow
                  key={banner.id}
                  banner={banner}
                  deletePending={deletePending}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </TableBody>
          </Table>
        )}
        <ListPagination
          page={page}
          limit={BANNERS_PAGE_SIZE}
          total={total}
          totalPages={totalPages}
          onPageChange={onPageChange}
          className="mt-2"
        />
      </CardContent>
    </Card>
  );
});

const StatsRow = memo(function StatsRow({
  total,
  activeCount,
}: {
  total: number;
  activeCount: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card className="border-white/10 bg-[#002833]">
        <CardContent className="pt-6">
          <p className="text-sm text-white/60">Total banners</p>
          <p className="text-3xl font-bold text-[#98E32F]">{total}</p>
        </CardContent>
      </Card>
      <Card className="border-white/10 bg-[#002833]">
        <CardContent className="pt-6">
          <p className="text-sm text-white/60">Active (this page)</p>
          <p className="text-3xl font-bold text-[#98E32F]">{activeCount}</p>
        </CardContent>
      </Card>
    </div>
  );
});

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; id: string; banner: AdminHomeBanner };

function BannerEditorDialog({
  editor,
  onClose,
}: {
  editor: EditorState;
  onClose: () => void;
}) {
  /** Mount form only after dialog shell paints — keeps Add/Edit click light. */
  const [formReady, setFormReady] = useState(false);

  useEffect(() => {
    setFormReady(false);
    const id = window.setTimeout(() => setFormReady(true), 120);
    return () => window.clearTimeout(id);
  }, [editor.mode, editor.mode === "edit" ? editor.id : "create"]);

  const title = editor.mode === "edit" ? "Edit banner" : "Create banner";

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton
        className="max-h-[90vh] w-full max-w-[calc(100%-1.5rem)] overflow-y-auto border-white/10 bg-[#002833] text-white duration-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 sm:max-w-3xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
          <DialogDescription className="text-white/50">
            Upload an image, set schedule, and optionally link to a restaurant or
            dishes.
          </DialogDescription>
        </DialogHeader>

        {!formReady ? (
          <div className="flex justify-center py-12 text-white/40">
            <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
          </div>
        ) : editor.mode === "create" ? (
          <BannerEditorCard
            key="create"
            editingId={null}
            embedded
            onCancel={onClose}
            onSaved={onClose}
          />
        ) : (
          <BannerEditorCard
            key={editor.id}
            editingId={editor.id}
            initialBanner={editor.banner}
            embedded
            onCancel={onClose}
            onSaved={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Isolated so Add click only re-renders this button, not the banners table. */
const AddBannerButton = memo(function AddBannerButton({
  disabled,
  onOpen,
}: {
  disabled: boolean;
  onOpen: () => void;
}) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!disabled) setPending(false);
  }, [disabled]);

  return (
    <Button
      type="button"
      className="shrink-0"
      disabled={disabled || pending}
      onPointerEnter={() => {
        void loadBannerEditor();
      }}
      onFocus={() => {
        void loadBannerEditor();
      }}
      onClick={() => {
        setPending(true);
        afterNextPaint(() => {
          onOpen();
        });
      }}
    >
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Plus className="mr-2 h-4 w-4" />
      )}
      Add banner
    </Button>
  );
});

export default function BannersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [, startUiTransition] = useTransition();
  const deleteMutateRef = useRef<(id: string) => void>(() => {});
  const bannersByIdRef = useRef<Map<string, AdminHomeBanner>>(new Map());

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadBannerEditor();
    }, 800);
    return () => window.clearTimeout(t);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-banners", page],
    queryFn: () => fetchBanners({ page, limit: BANNERS_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const banners = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  bannersByIdRef.current = new Map(banners.map((b) => [b.id, b]));

  const deleteMutation = useMutation({
    mutationFn: deleteBanner,
    onSuccess: (_data, deletedId) => {
      // Defer cache work so the confirm click paints first.
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
        setEditor((cur) =>
          cur?.mode === "edit" && cur.id === deletedId ? null : cur,
        );
      });
      toast.success("Banner deleted");
    },
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) &&
        typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "Failed to delete banner";
      toast.error(message);
    },
  });

  deleteMutateRef.current = (id: string) => {
    deleteMutation.mutate(id);
  };

  const activeCount = useMemo(
    () => banners.filter((b) => b.isActive).length,
    [banners],
  );

  const openCreate = useCallback(() => {
    startUiTransition(() => {
      setEditor({ mode: "create" });
    });
  }, [startUiTransition]);

  const startEdit = useCallback(
    (id: string) => {
      const banner = bannersByIdRef.current.get(id);
      if (!banner) {
        toast.error("Banner not found — refresh and try again.");
        return;
      }
      // Snapshot after click returns — do not clone heavy work in the handler.
      afterNextPaint(() => {
        const snapshot: AdminHomeBanner = {
          id: banner.id,
          title: banner.title,
          subtitle: banner.subtitle,
          imageUrl: banner.imageUrl,
          imageStaticUrl: banner.imageStaticUrl,
          linkType: banner.linkType,
          restaurantId: banner.restaurantId,
          menuItemId: banner.menuItemId,
          menuItemIds: [...(banner.menuItemIds ?? [])],
          offerId: banner.offerId ?? null,
          sortOrder: banner.sortOrder,
          isActive: banner.isActive,
          startsAt: banner.startsAt,
          endsAt: banner.endsAt,
        };
        startUiTransition(() => {
          setEditor({ mode: "edit", id: snapshot.id, banner: snapshot });
        });
      });
    },
    [startUiTransition],
  );

  const closeEditor = useCallback(() => {
    startTransition(() => setEditor(null));
  }, []);

  /** Opens a non-blocking dialog — never use window.confirm (blocks INP). */
  const requestDelete = useCallback((id: string) => {
    const banner = bannersByIdRef.current.get(id);
    setDeleteTarget({
      id,
      title: banner?.title?.trim() || "this banner",
    });
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    // Leave the click task before starting the mutation / refetch.
    window.setTimeout(() => {
      deleteMutateRef.current(id);
    }, 0);
  }, [deleteTarget]);

  const handlePageChange = useCallback((next: number) => {
    startTransition(() => setPage(next));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Home banners</h2>
          <p className="mt-1 text-sm text-white/60">
            Manage promo carousel on the customer app home screen. Link to a
            restaurant or dish(es).
          </p>
        </div>
        <AddBannerButton
          disabled={editor !== null}
          onOpen={openCreate}
        />
      </div>

      <StatsRow total={total} activeCount={activeCount} />

      <BannersListCard
        banners={banners}
        isLoading={isLoading}
        page={page}
        total={total}
        totalPages={totalPages}
        deletePending={deleteMutation.isPending}
        onPageChange={handlePageChange}
        onEdit={startEdit}
        onDelete={requestDelete}
      />

      {editor ? (
        <BannerEditorDialog editor={editor} onClose={closeEditor} />
      ) : null}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) cancelDelete();
        }}
      >
        <DialogContent className="border-white/10 bg-[#002833] text-white duration-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Delete banner?</DialogTitle>
            <DialogDescription className="text-white/50">
              This permanently removes{" "}
              <span className="text-white/80">
                &ldquo;{deleteTarget?.title}&rdquo;
              </span>
              . This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={cancelDelete}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
