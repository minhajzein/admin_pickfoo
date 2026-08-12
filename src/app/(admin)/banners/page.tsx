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

const BannerEditorCard = dynamic(
  () =>
    import("@/components/banners/BannerEditorCard").then(
      (m) => m.BannerEditorCard,
    ),
  {
    ssr: false,
    loading: () => (
      <Card className="border-white/10 bg-[#002833] ring-1 ring-[#98E32F]/30">
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
        </CardContent>
      </Card>
    ),
  },
);

const BANNERS_PAGE_SIZE = 10;

const linkTypeLabels: Record<HomeBannerLinkType, string> = {
  none: "No link",
  restaurant: "Restaurant",
  dish: "Single dish",
  dishes: "Multiple dishes",
};

function linkSummary(banner: AdminHomeBanner) {
  if (banner.linkType === "restaurant")
    return `Restaurant: ${banner.restaurantId}`;
  if (banner.linkType === "dish") return `Dish: ${banner.menuItemId}`;
  if (banner.linkType === "dishes")
    return `${banner.menuItemIds.length} dishes`;
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

function scheduleDeferred(work: () => void) {
  requestAnimationFrame(() => {
    window.setTimeout(work, 0);
  });
}

const BannerThumb = memo(function BannerThumb({
  src,
  priority,
}: {
  src: string;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={96}
      height={56}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "low"}
      className="h-14 w-24 rounded bg-black/20 object-cover"
    />
  );
});

const BannerRow = memo(function BannerRow({
  banner,
  priority,
  deletePending,
  onEdit,
  onDelete,
}: {
  banner: AdminHomeBanner;
  priority: boolean;
  deletePending: boolean;
  onEdit: (banner: AdminHomeBanner) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <BannerThumb src={banner.imageUrl} priority={priority} />
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
            onClick={() => onEdit(banner)}
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
            onClick={() => {
              if (
                confirm(
                  `Delete banner "${banner.title?.trim() || "this banner"}"?`,
                )
              ) {
                onDelete(banner.id);
              }
            }}
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
  onEdit: (banner: AdminHomeBanner) => void;
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
              {banners.map((banner, index) => (
                <BannerRow
                  key={banner.id}
                  banner={banner}
                  priority={index < 3}
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
  editor: EditorState | null;
  onClose: () => void;
}) {
  const open = editor !== null;
  const title =
    editor?.mode === "edit" ? "Edit banner" : "Create banner";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton
        className="max-h-[90vh] w-full max-w-[calc(100%-1.5rem)] overflow-y-auto border-white/10 bg-[#002833] text-white sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
          <DialogDescription className="text-white/50">
            Upload an image, set schedule, and optionally link to a restaurant or
            dishes.
          </DialogDescription>
        </DialogHeader>

        {editor?.mode === "create" ? (
          <BannerEditorCard
            key="create"
            editingId={null}
            embedded
            onCancel={onClose}
            onSaved={onClose}
          />
        ) : null}
        {editor?.mode === "edit" ? (
          <BannerEditorCard
            key={editor.id}
            editingId={editor.id}
            initialBanner={editor.banner}
            embedded
            onCancel={onClose}
            onSaved={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function BannersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [, startUiTransition] = useTransition();
  const deleteMutateRef = useRef<(id: string) => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) void import("@/components/banners/BannerEditorCard");
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-banners", page],
    queryFn: () => fetchBanners({ page, limit: BANNERS_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const banners = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: deleteBanner,
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      toast.success("Banner deleted");
      setEditor((cur) =>
        cur?.mode === "edit" && cur.id === deletedId ? null : cur,
      );
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
    setEditorBusy(true);
    scheduleDeferred(() => {
      startUiTransition(() => {
        setEditor({ mode: "create" });
        setEditorBusy(false);
      });
    });
  }, [startUiTransition]);

  const startEdit = useCallback(
    (banner: AdminHomeBanner) => {
      const id = String(banner.id ?? "").trim();
      if (!id) {
        toast.error("This banner has no id — refresh the list and try again.");
        return;
      }
      // Clone a lean snapshot so the list row object isn't held by the editor.
      const snapshot: AdminHomeBanner = {
        id,
        title: banner.title,
        subtitle: banner.subtitle,
        imageUrl: banner.imageUrl,
        imageStaticUrl: banner.imageStaticUrl,
        linkType: banner.linkType,
        restaurantId: banner.restaurantId,
        menuItemId: banner.menuItemId,
        menuItemIds: [...(banner.menuItemIds ?? [])],
        sortOrder: banner.sortOrder,
        isActive: banner.isActive,
        startsAt: banner.startsAt,
        endsAt: banner.endsAt,
      };
      setEditorBusy(true);
      scheduleDeferred(() => {
        startUiTransition(() => {
          setEditor({ mode: "edit", id, banner: snapshot });
          setEditorBusy(false);
        });
      });
    },
    [startUiTransition],
  );

  const closeEditor = useCallback(() => {
    startTransition(() => setEditor(null));
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteMutateRef.current(id);
  }, []);

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
        <Button
          type="button"
          onClick={openCreate}
          className="shrink-0"
          disabled={editorBusy || editor !== null}
        >
          {editorBusy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Add banner
        </Button>
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
        onDelete={handleDelete}
      />

      <BannerEditorDialog editor={editor} onClose={closeEditor} />
    </div>
  );
}
