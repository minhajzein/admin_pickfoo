"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import NextImage from "next/image";
import { ImagePlus, Loader2, Save, Store } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  updateRestaurantProfile,
  uploadRestaurantImage,
} from "@/lib/api/restaurants";

type ProfileRestaurant = {
  _id?: string;
  name: string;
  description?: string;
  contactNumber?: string;
  brandLogo?: string;
  image?: string;
};

function ImagePicker({
  label,
  hint,
  previewUrl,
  uploading,
  onPick,
  square = false,
}: {
  label: string;
  hint: string;
  previewUrl?: string;
  uploading: boolean;
  onPick: (file: File) => void;
  square?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const aspectClass = square ? "aspect-square max-w-[180px]" : "aspect-[16/9] w-full";

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
        {label}
      </p>
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="relative w-full overflow-hidden rounded-xl border border-dashed border-white/15 bg-black/20 text-left transition-colors hover:border-[#98E32F]/40 hover:bg-[#98E32F]/5 disabled:opacity-60"
      >
        {previewUrl ? (
          <div className={`relative ${aspectClass}`}>
            <NextImage
              src={previewUrl}
              alt={label}
              fill
              unoptimized
              className="object-cover"
            />
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" />
                )}
                {uploading ? "Uploading…" : "Change image"}
              </span>
            </div>
          </div>
        ) : (
          <div
            className={`flex ${aspectClass} flex-col items-center justify-center gap-2 text-white/30`}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
            ) : (
              <Store className="h-8 w-8" />
            )}
            <span className="text-xs font-bold">
              {uploading ? "Uploading…" : "Click to upload"}
            </span>
            <span className="px-4 text-center text-[10px] text-white/25">{hint}</span>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
    </div>
  );
}

export function RestaurantProfileEditor({
  restaurantId,
  restaurant,
}: {
  restaurantId: string;
  restaurant: ProfileRestaurant;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(restaurant.name ?? "");
  const [description, setDescription] = useState(restaurant.description ?? "");
  const [contactNumber, setContactNumber] = useState(
    restaurant.contactNumber ?? "",
  );
  const [brandLogoStatic, setBrandLogoStatic] = useState(restaurant.brandLogo ?? "");
  const [brandLogoPreview, setBrandLogoPreview] = useState(restaurant.brandLogo ?? "");
  const [coverStatic, setCoverStatic] = useState(restaurant.image ?? "");
  const [coverPreview, setCoverPreview] = useState(restaurant.image ?? "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    setName(restaurant.name ?? "");
    setDescription(restaurant.description ?? "");
    setContactNumber(restaurant.contactNumber ?? "");
    setBrandLogoStatic(restaurant.brandLogo ?? "");
    setBrandLogoPreview(restaurant.brandLogo ?? "");
    setCoverStatic(restaurant.image ?? "");
    setCoverPreview(restaurant.image ?? "");
  }, [
    restaurant.name,
    restaurant.description,
    restaurant.contactNumber,
    restaurant.brandLogo,
    restaurant.image,
  ]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateRestaurantProfile(restaurantId, {
        name: name.trim(),
        description: description.trim(),
        contactNumber: contactNumber.trim(),
        brandLogo: brandLogoStatic,
        image: coverStatic,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      toast.success("Restaurant details updated");
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to update restaurant details",
      );
    },
  });

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const uploaded = await uploadRestaurantImage(file, "restaurants/logos");
      setBrandLogoStatic(uploaded.staticUrl);
      setBrandLogoPreview(uploaded.fileUrl);
      toast.success("Brand logo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true);
    try {
      const uploaded = await uploadRestaurantImage(file, "restaurants");
      setCoverStatic(uploaded.staticUrl);
      setCoverPreview(uploaded.fileUrl);
      toast.success("Storefront image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cover upload failed");
    } finally {
      setUploadingCover(false);
    }
  };

  const busy =
    saveMutation.isPending || uploadingLogo || uploadingCover;

  return (
    <Card className="border-white/5 bg-[#002833] text-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Restaurant details</CardTitle>
        <CardDescription className="text-white/40">
          Update brand name, mobile number, description, logo, and storefront
          cover shown to customers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Brand name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:border-[#98E32F]/50 focus:outline-none disabled:opacity-60"
            placeholder="Restaurant brand name"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Mobile number
          </label>
          <input
            type="tel"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            disabled={busy}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:border-[#98E32F]/50 focus:outline-none disabled:opacity-60"
            placeholder="Restaurant contact number"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
            placeholder="Short description shown on the restaurant profile"
            className="h-28 resize-none border-white/10 bg-black/20 p-3 text-sm text-white focus:border-[#98E32F]/50"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ImagePicker
            label="Brand logo"
            hint="Square mark used in listings"
            previewUrl={brandLogoPreview || undefined}
            uploading={uploadingLogo}
            onPick={handleLogoUpload}
            square
          />
          <ImagePicker
            label="Storefront image"
            hint="Wide cover photo on the restaurant page"
            previewUrl={coverPreview || undefined}
            uploading={uploadingCover}
            onPick={handleCoverUpload}
          />
        </div>

        <Button
          type="button"
          className="w-full bg-[#98E32F] font-bold text-[#013644] hover:bg-[#86c926]"
          disabled={busy || !name.trim() || !contactNumber.trim()}
          onClick={() => {
            if (!name.trim()) {
              toast.error("Brand name is required");
              return;
            }
            if (!contactNumber.trim()) {
              toast.error("Mobile number is required");
              return;
            }
            saveMutation.mutate();
          }}
        >
          {saveMutation.isPending ? (
            <Loader2 className="mx-auto animate-spin" size={20} />
          ) : (
            <span className="inline-flex items-center gap-2">
              <Save size={18} />
              Save restaurant details
            </span>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
