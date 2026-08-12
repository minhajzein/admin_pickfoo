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
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

const BannerEditorCard = dynamic(
  () =>
    import("@/components/banners/BannerEditorCard").then(
      (m) => m.BannerEditorCard,
    ),
  {
    ssr: false,
    loading: () => (
      <Card className="bg-[#002833] border-white/10 ring-1 ring-[#98E32F]/30">
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
        </CardContent>
      </Card>
    ),
  },
);

const BANNERS_PAGE_SIZE = Math.min(DEFAULT_PAGE_SIZE, 15);

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

function scheduleDeferred(work: () => void) {
  // Let the click paint first, then mount the heavy editor off the critical path.
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
      className="h-14 w-24 rounded object-cover bg-black/20"
    />
  );
});

const BannersListCard = memo(function BannersListCard({
  banners,
  editingId,
  isLoading,
  page,
  total,
  totalPages,
  deletePending,
  showForm,
  editorBusy,
  onPageChange,
  onCreate,
  onEdit,
  onDelete,
}: {
  banners: AdminHomeBanner[];
  editingId: string | null;
  isLoading: boolean;
  page: number;
  total: number;
  totalPages: number;
  deletePending: boolean;
  showForm: boolean;
  editorBusy: boolean;
  onPageChange: (page: number) => void;
  onCreate: () => void;
  onEdit: (banner: AdminHomeBanner) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="bg-[#002833] border-white/10">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          All banners
        </CardTitle>
        {!showForm && (
          <Button
            type="button"
            onClick={onCreate}
            size="sm"
            disabled={editorBusy}
          >
            {editorBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add banner
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
          </div>
        ) : banners.length === 0 ? (
          <p className="text-center text-white/50 py-8 text-sm">
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
                <TableRow
                  key={banner.id}
                  className={
                    editingId === banner.id
                      ? "bg-[#98E32F]/10 ring-1 ring-inset ring-[#98E32F]/40"
                      : undefined
                  }
                >
                  <TableCell>
                    <BannerThumb src={banner.imageUrl} priority={index < 4} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {banner.title?.trim() || (
                        <span className="text-white/40 italic">No title</span>
                      )}
                    </div>
                    {banner.subtitle?.trim() ? (
                      <div className="text-xs text-white/50">
                        {banner.subtitle}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{linkTypeLabels[banner.linkType]}</div>
                    <div className="text-white/50">{linkSummary(banner)}</div>
                  </TableCell>
                  <TableCell className="text-xs text-white/60">
                    {banner.startsAt || banner.endsAt ? (
                      <div className="space-y-0.5">
                        {banner.startsAt && (
                          <div>
                            From {new Date(banner.startsAt).toLocaleString()}
                          </div>
                        )}
                        {banner.endsAt && (
                          <div>
                            To {new Date(banner.endsAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-white/40">Always</span>
                    )}
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
                        disabled={editorBusy}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onEdit(banner);
                        }}
                        aria-label={`Edit ${banner.title?.trim() || "banner"}`}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-red-400 hover:text-red-300"
                        disabled={deletePending}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
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

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; id: string; banner: AdminHomeBanner };

export default function BannersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [, startUiTransition] = useTransition();
  const deleteMutateRef = useRef<(id: string) => void>(() => {});

  // Warm the editor chunk so Add/Edit doesn't pay the import cost on click.
  useEffect(() => {
    let cancelled = false;
    const preload = () => {
      if (!cancelled) void import("@/components/banners/BannerEditorCard");
    };
    const timeoutId = window.setTimeout(preload, 300);
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
      setEditorBusy(true);
      scheduleDeferred(() => {
        startUiTransition(() => {
          setEditor({ mode: "edit", id, banner });
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

  const editingId = editor?.mode === "edit" ? editor.id : null;
  const showForm = editor !== null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Home banners</h2>
          <p className="text-white/60 text-sm mt-1">
            Manage promo carousel on the customer app home screen. Link to a
            restaurant or dish(es).
          </p>
        </div>
        {!showForm && (
          <Button
            type="button"
            onClick={openCreate}
            className="shrink-0"
            disabled={editorBusy}
          >
            {editorBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add banner
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#002833] border-white/10">
          <CardContent className="pt-6">
            <p className="text-sm text-white/60">Total banners</p>
            <p className="text-3xl font-bold text-[#98E32F]">{total}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#002833] border-white/10">
          <CardContent className="pt-6">
            <p className="text-sm text-white/60">Active (this page)</p>
            <p className="text-3xl font-bold text-[#98E32F]">{activeCount}</p>
          </CardContent>
        </Card>
      </div>

      {editor?.mode === "create" && (
        <BannerEditorCard
          key="create"
          editingId={null}
          onCancel={closeEditor}
          onSaved={closeEditor}
        />
      )}
      {editor?.mode === "edit" && (
        <BannerEditorCard
          key={editor.id}
          editingId={editor.id}
          initialBanner={editor.banner}
          onCancel={closeEditor}
          onSaved={closeEditor}
        />
      )}

      <BannersListCard
        banners={banners}
        editingId={editingId}
        isLoading={isLoading}
        page={page}
        total={total}
        totalPages={totalPages}
        deletePending={deleteMutation.isPending}
        showForm={showForm}
        editorBusy={editorBusy}
        onPageChange={handlePageChange}
        onCreate={openCreate}
        onEdit={startEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
