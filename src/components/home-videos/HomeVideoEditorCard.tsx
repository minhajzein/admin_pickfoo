"use client";

import { memo, startTransition, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createHomeVideo,
  HOME_VIDEO_MAX_DURATION_SEC,
  HOME_VIDEO_MAX_MB,
  updateHomeVideo,
  uploadHomeVideo,
  type AdminHomeVideo,
  type HomeVideoLinkType,
} from "@/lib/api/homeVideos";
import type { HomeVideoLinkTargetValue } from "@/components/home-videos/HomeVideoLinkTargetPicker";

const HomeVideoLinkTargetPicker = dynamic(
  () =>
    import("@/components/home-videos/HomeVideoLinkTargetPicker").then(
      (m) => m.HomeVideoLinkTargetPicker,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center py-6 text-white/40">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    ),
  },
);

const linkTypeLabels: Record<HomeVideoLinkType, string> = {
  none: "No link",
  restaurant: "Restaurant",
  dish: "Single dish",
  dishes: "Multiple dishes",
  category: "Category",
  offer: "Customer offer",
};

type FormFields = {
  title: string;
  videoStaticUrl: string;
  videoPreview: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  width: number;
  height: number;
  durationSec: number;
  linkType: HomeVideoLinkType;
  sortOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

function emptyFields(): FormFields {
  return {
    title: "",
    videoStaticUrl: "",
    videoPreview: "",
    storageKey: "",
    mimeType: "video/mp4",
    fileSize: 0,
    width: 0,
    height: 0,
    durationSec: 0,
    linkType: "none",
    sortOrder: 0,
    isActive: true,
    startsAt: "",
    endsAt: "",
  };
}

function emptyLink(): HomeVideoLinkTargetValue {
  return {
    restaurantId: "",
    menuItemId: "",
    menuItemIds: [],
    categoryId: "",
    categoryName: "",
    offerId: "",
  };
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(local: string): string | null {
  const trimmed = local.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (
    axios.isAxiosError(error) &&
    typeof error.response?.data?.message === "string"
  ) {
    return error.response.data.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function fieldsFromVideo(video: AdminHomeVideo): FormFields {
  return {
    title: video.title ?? "",
    videoStaticUrl: video.videoStaticUrl || video.videoUrl || "",
    videoPreview: video.videoUrl || video.videoStaticUrl || "",
    storageKey: video.storageKey ?? "",
    mimeType: video.mimeType ?? "video/mp4",
    fileSize: video.fileSize ?? 0,
    width: video.width ?? 0,
    height: video.height ?? 0,
    durationSec: video.durationSec ?? 0,
    linkType: video.linkType ?? "none",
    sortOrder: video.sortOrder ?? 0,
    isActive: video.isActive ?? true,
    startsAt: toDatetimeLocalValue(video.startsAt),
    endsAt: toDatetimeLocalValue(video.endsAt),
  };
}

function linkFromVideo(video: AdminHomeVideo): HomeVideoLinkTargetValue {
  return {
    restaurantId: video.restaurantId ?? "",
    menuItemId: video.menuItemId ?? "",
    menuItemIds: video.menuItemIds ?? [],
    categoryId: video.categoryId ?? "",
    categoryName: video.categoryName ?? "",
    offerId: video.offerId ?? "",
  };
}

const VideoPreview = memo(function VideoPreview({ src }: { src: string }) {
  return (
    <video
      src={src}
      muted
      playsInline
      loop
      autoPlay
      controls
      className="mt-2 aspect-[4/1] w-full max-w-3xl rounded-lg border border-white/10 bg-black object-cover"
    />
  );
});

type Props = {
  editingId: string | null;
  initialVideo?: AdminHomeVideo | null;
  onCancel: () => void;
  onSaved: () => void;
  embedded?: boolean;
};

export function HomeVideoEditorCard({
  editingId,
  initialVideo,
  onCancel,
  onSaved,
  embedded = false,
}: Props) {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<FormFields>(() =>
    initialVideo ? fieldsFromVideo(initialVideo) : emptyFields(),
  );
  const [link, setLink] = useState<HomeVideoLinkTargetValue>(() =>
    initialVideo ? linkFromVideo(initialVideo) : emptyLink(),
  );
  const [uploading, setUploading] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const videoStaticUrl =
        fields.videoStaticUrl.trim() || fields.videoPreview.trim();
      if (!videoStaticUrl) {
        throw new Error("Please upload a home video first");
      }
      if (fields.linkType === "restaurant" && !link.restaurantId) {
        throw new Error("Select a restaurant for this link type");
      }
      if (fields.linkType === "dish" && !link.menuItemId) {
        throw new Error("Select a dish for this link type");
      }
      if (fields.linkType === "dishes" && link.menuItemIds.length === 0) {
        throw new Error("Select at least one dish for this link type");
      }
      if (fields.linkType === "category" && !link.categoryId) {
        throw new Error("Select a category for this link type");
      }
      if (fields.linkType === "offer" && !link.offerId) {
        throw new Error("Select a customer offer for this link type");
      }

      const payload = {
        title: fields.title.trim(),
        videoStaticUrl,
        storageKey: fields.storageKey || undefined,
        mimeType: fields.mimeType || "video/mp4",
        fileSize: fields.fileSize || undefined,
        width: fields.width || undefined,
        height: fields.height || undefined,
        durationSec: fields.durationSec || undefined,
        linkType: fields.linkType,
        restaurantId:
          fields.linkType === "restaurant" ||
          fields.linkType === "dish" ||
          fields.linkType === "dishes"
            ? link.restaurantId || null
            : null,
        menuItemId:
          fields.linkType === "dish" ? link.menuItemId || null : null,
        menuItemIds: fields.linkType === "dishes" ? link.menuItemIds : [],
        categoryId:
          fields.linkType === "category" ? link.categoryId || null : null,
        offerId: fields.linkType === "offer" ? link.offerId || null : null,
        sortOrder: Number(fields.sortOrder) || 0,
        isActive: fields.isActive,
        startsAt: fromDatetimeLocalValue(fields.startsAt),
        endsAt: fromDatetimeLocalValue(fields.endsAt),
      };

      if (editingId) return updateHomeVideo(editingId, payload);
      return createHomeVideo(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "Home video updated" : "Home video created");
      window.setTimeout(() => {
        startTransition(() => {
          queryClient.invalidateQueries({ queryKey: ["admin-home-videos"] });
          onSaved();
        });
      }, 0);
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Failed to save home video"));
    },
  });

  const onPickVideo = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadHomeVideo(file);
      setFields((f) => ({
        ...f,
        videoStaticUrl: uploaded.staticUrl,
        videoPreview: uploaded.fileUrl,
        storageKey: uploaded.storageKey ?? "",
        mimeType: uploaded.mimeType ?? "video/mp4",
        fileSize: uploaded.fileSize ?? file.size,
        width: uploaded.width ?? 0,
        height: uploaded.height ?? 0,
        durationSec: uploaded.durationSec ?? 0,
      }));
      toast.success("Video uploaded");
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const onLinkChange = useCallback((next: HomeVideoLinkTargetValue) => {
    setLink(next);
  }, []);

  const videoReady =
    Boolean(fields.videoStaticUrl.trim()) ||
    Boolean(fields.videoPreview.trim());

  const form = (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        window.setTimeout(() => {
          saveMutation.mutate();
        }, 0);
      }}
      noValidate
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Title (optional)</Label>
          <Input
            value={fields.title}
            onChange={(e) =>
              setFields((f) => ({ ...f, title: e.target.value }))
            }
            placeholder="Weekend special"
          />
        </div>
        <div className="space-y-2">
          <Label>Sort order</Label>
          <Input
            type="number"
            value={fields.sortOrder}
            onChange={(e) =>
              setFields((f) => ({
                ...f,
                sortOrder: Number(e.target.value) || 0,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Link type</Label>
          <select
            className="h-10 w-full rounded-md border border-white/20 bg-[#013644] px-3 text-sm"
            value={fields.linkType}
            onChange={(e) => {
              const linkType = e.target.value as HomeVideoLinkType;
              setFields((f) => ({ ...f, linkType }));
              setLink(emptyLink());
            }}
          >
            {Object.entries(linkTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Starts at (optional)</Label>
          <Input
            type="datetime-local"
            value={fields.startsAt}
            onChange={(e) =>
              setFields((f) => ({ ...f, startsAt: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Ends at (optional)</Label>
          <Input
            type="datetime-local"
            value={fields.endsAt}
            onChange={(e) =>
              setFields((f) => ({ ...f, endsAt: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Home video (landscape 4:1 MP4)</Label>
        <p className="text-xs text-white/50">
          Upload a landscape MP4 (wider than tall) at ~4:1 aspect, max{" "}
          {HOME_VIDEO_MAX_MB} MB and {HOME_VIDEO_MAX_DURATION_SEC}s. Portrait
          videos are rejected. Matches the customer home carousel.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="file"
            accept="video/mp4,.mp4"
            onChange={(e) => onPickVideo(e.target.files?.[0] ?? null)}
            disabled={uploading}
          />
          {uploading && (
            <Loader2 className="h-5 w-5 animate-spin text-[#98E32F]" />
          )}
        </div>
        {fields.width > 0 && fields.height > 0 ? (
          <p className="text-xs text-white/50">
            {fields.width}×{fields.height}
            {fields.durationSec
              ? ` · ${fields.durationSec.toFixed(1)}s`
              : ""}
            {fields.fileSize
              ? ` · ${(fields.fileSize / (1024 * 1024)).toFixed(1)} MB`
              : ""}
          </p>
        ) : null}
        {fields.videoPreview ? <VideoPreview src={fields.videoPreview} /> : null}
        {!videoReady && (
          <p className="text-xs text-amber-400/90">
            Upload a video before saving — the create button needs a successful
            upload.
          </p>
        )}
      </div>

      {fields.linkType !== "none" && (
        <HomeVideoLinkTargetPicker
          key={`${editingId ?? "new"}-${fields.linkType}`}
          linkType={fields.linkType}
          value={link}
          onChange={onLinkChange}
        />
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={fields.isActive}
          onChange={(e) =>
            setFields((f) => ({ ...f, isActive: e.target.checked }))
          }
        />
        Active (visible on customer home)
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" disabled={saveMutation.isPending || uploading}>
          {saveMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {editingId ? "Update video" : "Create video"}
        </Button>
        {embedded ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );

  if (embedded) {
    return form;
  }

  return (
    <Card className="border-white/10 bg-[#002833] ring-1 ring-[#98E32F]/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{editingId ? "Edit home video" : "Create home video"}</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">{form}</CardContent>
    </Card>
  );
}
