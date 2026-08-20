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
import { Clapperboard, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
  deleteHomeVideo,
  fetchHomeVideos,
  type AdminHomeVideo,
  type HomeVideoLinkType,
} from "@/lib/api/homeVideos";
import { ListPagination } from "@/components/ui/list-pagination";

const loadHomeVideoEditor = () =>
  import("@/components/home-videos/HomeVideoEditorCard").then(
    (m) => m.HomeVideoEditorCard,
  );

const HomeVideoEditorCard = dynamic(loadHomeVideoEditor, {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-12 text-white/40">
      <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
    </div>
  ),
});

function afterNextPaint(fn: () => void) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(fn);
  });
}

const HOME_VIDEOS_PAGE_SIZE = 10;

const linkTypeLabels: Record<HomeVideoLinkType, string> = {
  none: "No link",
  restaurant: "Restaurant",
  dish: "Single dish",
  dishes: "Multiple dishes",
  category: "Category",
  offer: "Customer offer",
};

function linkSummary(video: AdminHomeVideo) {
  if (video.linkType === "restaurant")
    return `Restaurant: ${video.restaurantId}`;
  if (video.linkType === "dish") return `Dish: ${video.menuItemId}`;
  if (video.linkType === "dishes")
    return `${video.menuItemIds.length} dishes`;
  if (video.linkType === "category")
    return video.categoryName || video.categoryId || "—";
  if (video.linkType === "offer") return `Offer: ${video.offerId}`;
  return "—";
}

function formatSchedule(video: AdminHomeVideo): string {
  if (!video.startsAt && !video.endsAt) return "Always";
  const parts: string[] = [];
  if (video.startsAt) {
    parts.push(`From ${new Date(video.startsAt).toLocaleString()}`);
  }
  if (video.endsAt) {
    parts.push(`To ${new Date(video.endsAt).toLocaleString()}`);
  }
  return parts.join(" · ");
}

const HomeVideoRow = memo(function HomeVideoRow({
  video,
  deletePending,
  onEdit,
  onDelete,
}: {
  video: AdminHomeVideo;
  deletePending: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex h-14 w-28 items-center justify-center rounded border border-white/10 bg-black/30 text-[#98E32F]/70">
          <Clapperboard className="h-5 w-5" />
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">
          {video.title?.trim() || (
            <span className="italic text-white/40">No title</span>
          )}
        </div>
        {video.width != null &&
        video.width > 0 &&
        video.height != null &&
        video.height > 0 ? (
          <div className="text-xs text-white/50">
            {video.width}×{video.height}
            {video.durationSec ? ` · ${video.durationSec.toFixed(1)}s` : ""}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="text-xs">
        <div>{linkTypeLabels[video.linkType]}</div>
        <div className="text-white/50">{linkSummary(video)}</div>
      </TableCell>
      <TableCell className="text-xs text-white/60">
        {formatSchedule(video)}
      </TableCell>
      <TableCell>{video.sortOrder}</TableCell>
      <TableCell>
        <Badge variant={video.isActive ? "default" : "outline"}>
          {video.isActive ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onEdit(video.id)}
            aria-label={`Edit ${video.title?.trim() || "home video"}`}
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
            onClick={() => onDelete(video.id)}
            aria-label={`Delete ${video.title?.trim() || "home video"}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

const HomeVideosListCard = memo(function HomeVideosListCard({
  videos,
  isLoading,
  page,
  total,
  totalPages,
  deletePending,
  onPageChange,
  onEdit,
  onDelete,
}: {
  videos: AdminHomeVideo[];
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
          <Clapperboard className="h-5 w-5" />
          All home videos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
          </div>
        ) : videos.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/50">
            No home videos yet. Click{" "}
            <strong className="text-white/80">Add video</strong> to create one.
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
              {videos.map((video) => (
                <HomeVideoRow
                  key={video.id}
                  video={video}
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
          limit={HOME_VIDEOS_PAGE_SIZE}
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
          <p className="text-sm text-white/60">Total videos</p>
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
  | { mode: "edit"; id: string; video: AdminHomeVideo };

function HomeVideoEditorDialog({
  editor,
  onClose,
}: {
  editor: EditorState;
  onClose: () => void;
}) {
  const [formReady, setFormReady] = useState(false);

  useEffect(() => {
    setFormReady(false);
    const id = window.setTimeout(() => setFormReady(true), 120);
    return () => window.clearTimeout(id);
  }, [editor.mode, editor.mode === "edit" ? editor.id : "create"]);

  const title = editor.mode === "edit" ? "Edit home video" : "Create home video";

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
            Upload a landscape 4:1 MP4 (max 20 MB / 30s), set schedule, and
            optionally link to a restaurant, dishes, or category.
          </DialogDescription>
        </DialogHeader>

        {!formReady ? (
          <div className="flex justify-center py-12 text-white/40">
            <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
          </div>
        ) : editor.mode === "create" ? (
          <HomeVideoEditorCard
            key="create"
            editingId={null}
            embedded
            onCancel={onClose}
            onSaved={onClose}
          />
        ) : (
          <HomeVideoEditorCard
            key={editor.id}
            editingId={editor.id}
            initialVideo={editor.video}
            embedded
            onCancel={onClose}
            onSaved={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

const AddHomeVideoButton = memo(function AddHomeVideoButton({
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
        void loadHomeVideoEditor();
      }}
      onFocus={() => {
        void loadHomeVideoEditor();
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
      Add video
    </Button>
  );
});

export default function HomeVideosPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [, startUiTransition] = useTransition();
  const deleteMutateRef = useRef<(id: string) => void>(() => {});
  const videosByIdRef = useRef<Map<string, AdminHomeVideo>>(new Map());

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadHomeVideoEditor();
    }, 800);
    return () => window.clearTimeout(t);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-home-videos", page],
    queryFn: () => fetchHomeVideos({ page, limit: HOME_VIDEOS_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const videos = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  videosByIdRef.current = new Map(videos.map((v) => [v.id, v]));

  const deleteMutation = useMutation({
    mutationFn: deleteHomeVideo,
    onSuccess: (_data, deletedId) => {
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ["admin-home-videos"] });
        setEditor((cur) =>
          cur?.mode === "edit" && cur.id === deletedId ? null : cur,
        );
      });
      toast.success("Home video deleted");
    },
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) &&
        typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "Failed to delete home video";
      toast.error(message);
    },
  });

  deleteMutateRef.current = (id: string) => {
    deleteMutation.mutate(id);
  };

  const activeCount = useMemo(
    () => videos.filter((v) => v.isActive).length,
    [videos],
  );

  const openCreate = useCallback(() => {
    startUiTransition(() => {
      setEditor({ mode: "create" });
    });
  }, [startUiTransition]);

  const startEdit = useCallback(
    (id: string) => {
      const video = videosByIdRef.current.get(id);
      if (!video) {
        toast.error("Home video not found — refresh and try again.");
        return;
      }
      afterNextPaint(() => {
        const snapshot: AdminHomeVideo = {
          id: video.id,
          title: video.title,
          videoUrl: video.videoUrl,
          videoStaticUrl: video.videoStaticUrl,
          storageKey: video.storageKey,
          mimeType: video.mimeType,
          fileSize: video.fileSize,
          width: video.width,
          height: video.height,
          durationSec: video.durationSec,
          linkType: video.linkType,
          restaurantId: video.restaurantId,
          menuItemId: video.menuItemId,
          menuItemIds: [...(video.menuItemIds ?? [])],
          offerId: video.offerId ?? null,
          categoryId: video.categoryId,
          categoryName: video.categoryName,
          sortOrder: video.sortOrder,
          isActive: video.isActive,
          startsAt: video.startsAt,
          endsAt: video.endsAt,
        };
        startUiTransition(() => {
          setEditor({ mode: "edit", id: snapshot.id, video: snapshot });
        });
      });
    },
    [startUiTransition],
  );

  const closeEditor = useCallback(() => {
    startTransition(() => setEditor(null));
  }, []);

  const requestDelete = useCallback((id: string) => {
    const video = videosByIdRef.current.get(id);
    setDeleteTarget({
      id,
      title: video?.title?.trim() || "this home video",
    });
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
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
          <h2 className="text-2xl font-bold tracking-tight">Home videos</h2>
          <p className="mt-1 text-sm text-white/60">
            Manage the landscape 4:1 video carousel on the customer app home
            screen. Upload landscape MP4s (max 20 MB / 30s) and optionally link
            to a restaurant, dish(es), or category.
          </p>
        </div>
        <AddHomeVideoButton disabled={editor !== null} onOpen={openCreate} />
      </div>

      <StatsRow total={total} activeCount={activeCount} />

      <HomeVideosListCard
        videos={videos}
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
        <HomeVideoEditorDialog editor={editor} onClose={closeEditor} />
      ) : null}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) cancelDelete();
        }}
      >
        <DialogContent className="border-white/10 bg-[#002833] text-white duration-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Delete home video?</DialogTitle>
            <DialogDescription className="text-white/50">
              This permanently removes{" "}
              <span className="text-white/80">
                &ldquo;{deleteTarget?.title}&rdquo;
              </span>{" "}
              and its stored file. This cannot be undone.
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
