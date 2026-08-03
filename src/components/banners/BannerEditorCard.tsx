"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createBanner,
  updateBanner,
  uploadBannerImage,
  type AdminHomeBanner,
  type HomeBannerLinkType,
} from "@/lib/api/banners";
import {
  BannerLinkTargetPicker,
  type LinkTargetValue,
} from "@/components/banners/BannerLinkTargetPicker";

const linkTypeLabels: Record<HomeBannerLinkType, string> = {
  none: "No link",
  restaurant: "Restaurant",
  dish: "Single dish",
  dishes: "Multiple dishes",
};

type FormFields = {
  title: string;
  subtitle: string;
  imageStaticUrl: string;
  imagePreview: string;
  linkType: HomeBannerLinkType;
  sortOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

function emptyFields(): FormFields {
  return {
    title: "",
    subtitle: "",
    imageStaticUrl: "",
    imagePreview: "",
    linkType: "none",
    sortOrder: 0,
    isActive: true,
    startsAt: "",
    endsAt: "",
  };
}

function emptyLink(): LinkTargetValue {
  return { restaurantId: "", menuItemId: "", menuItemIds: [] };
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

function fieldsFromBanner(banner: AdminHomeBanner): FormFields {
  return {
    title: banner.title ?? "",
    subtitle: banner.subtitle ?? "",
    imageStaticUrl: banner.imageStaticUrl || banner.imageUrl || "",
    imagePreview: banner.imageUrl || banner.imageStaticUrl || "",
    linkType: banner.linkType ?? "none",
    sortOrder: banner.sortOrder ?? 0,
    isActive: banner.isActive ?? true,
    startsAt: toDatetimeLocalValue(banner.startsAt),
    endsAt: toDatetimeLocalValue(banner.endsAt),
  };
}

function linkFromBanner(banner: AdminHomeBanner): LinkTargetValue {
  return {
    restaurantId: banner.restaurantId ?? "",
    menuItemId: banner.menuItemId ?? "",
    menuItemIds: banner.menuItemIds ?? [],
  };
}

type Props = {
  editingId: string | null;
  initialBanner?: AdminHomeBanner | null;
  onCancel: () => void;
  onSaved: () => void;
};

export function BannerEditorCard({
  editingId,
  initialBanner,
  onCancel,
  onSaved,
}: Props) {
  const queryClient = useQueryClient();
  const cardRef = useRef<HTMLDivElement>(null);
  const [fields, setFields] = useState<FormFields>(() =>
    initialBanner ? fieldsFromBanner(initialBanner) : emptyFields(),
  );
  const [link, setLink] = useState<LinkTargetValue>(() =>
    initialBanner ? linkFromBanner(initialBanner) : emptyLink(),
  );
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const imageStaticUrl =
        fields.imageStaticUrl.trim() || fields.imagePreview.trim();
      if (!imageStaticUrl) {
        throw new Error("Please upload a banner image first");
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

      const payload = {
        title: fields.title.trim(),
        subtitle: fields.subtitle.trim(),
        imageStaticUrl,
        linkType: fields.linkType,
        restaurantId:
          fields.linkType === "restaurant" ||
          fields.linkType === "dish" ||
          fields.linkType === "dishes"
            ? link.restaurantId || null
            : null,
        menuItemId:
          fields.linkType === "dish" ? link.menuItemId || null : null,
        menuItemIds:
          fields.linkType === "dishes" ? link.menuItemIds : [],
        sortOrder: Number(fields.sortOrder) || 0,
        isActive: fields.isActive,
        startsAt: fromDatetimeLocalValue(fields.startsAt),
        endsAt: fromDatetimeLocalValue(fields.endsAt),
      };

      if (editingId) return updateBanner(editingId, payload);
      return createBanner(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      toast.success(editingId ? "Banner updated" : "Banner created");
      onSaved();
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Failed to save banner"));
    },
  });

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadBannerImage(file);
      setFields((f) => ({
        ...f,
        imageStaticUrl: uploaded.staticUrl,
        imagePreview: uploaded.fileUrl,
      }));
      toast.success("Image uploaded");
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const onLinkChange = useCallback((next: LinkTargetValue) => {
    setLink(next);
  }, []);

  const imageReady =
    Boolean(fields.imageStaticUrl.trim()) ||
    Boolean(fields.imagePreview.trim());

  return (
    <Card
      ref={cardRef}
      className="bg-[#002833] border-white/10 ring-1 ring-[#98E32F]/30"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{editingId ? "Edit banner" : "Create banner"}</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          noValidate
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title (optional)</Label>
              <Input
                value={fields.title}
                onChange={(e) =>
                  setFields((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="FLAT ₹100 OFF"
              />
            </div>
            <div className="space-y-2">
              <Label>Subtitle (optional)</Label>
              <Input
                value={fields.subtitle}
                onChange={(e) =>
                  setFields((f) => ({ ...f, subtitle: e.target.value }))
                }
                placeholder="On your first 5 orders"
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
                className="w-full h-10 rounded-md bg-[#013644] border border-white/20 px-3 text-sm"
                value={fields.linkType}
                onChange={(e) => {
                  const linkType = e.target.value as HomeBannerLinkType;
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
            <Label>Banner image</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                disabled={uploading}
              />
              {uploading && (
                <Loader2 className="h-5 w-5 animate-spin text-[#98E32F]" />
              )}
            </div>
            {fields.imagePreview ? (
              <img
                src={fields.imagePreview}
                alt="Preview"
                className="mt-2 h-32 w-full max-w-md rounded-lg object-cover border border-white/10"
              />
            ) : null}
            {!imageReady && (
              <p className="text-xs text-amber-400/90">
                Upload an image before saving — the create button needs a
                successful upload.
              </p>
            )}
          </div>

          {fields.linkType !== "none" && (
            <BannerLinkTargetPicker
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

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={saveMutation.isPending || uploading}
            >
              {saveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingId ? "Update banner" : "Create banner"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
