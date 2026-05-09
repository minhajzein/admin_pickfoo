"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchPartner,
  updatePartnerPriorityLevel,
  updatePartnerZones,
  verifyPartner,
} from "@/lib/api/partners";
import { fetchZones } from "@/lib/api/zones";
import {
  Loader2,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Calendar,
  ExternalLink,
} from "lucide-react";

function urlPathLower(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.toLowerCase();
  } catch {
    return url.toLowerCase().split("?")[0];
  }
}

function isImageAsset(url: string): boolean {
  const path = urlPathLower(url);
  return (
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".png") ||
    path.endsWith(".webp") ||
    path.endsWith(".gif") ||
    path.endsWith(".heic") ||
    path.endsWith(".heif")
  );
}

function isPdfAsset(url: string): boolean {
  return urlPathLower(url).endsWith(".pdf");
}

function UploadedAssetCard({
  title,
  url,
}: {
  title: string;
  url?: string;
}) {
  if (!url) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/40">
        {title}: not uploaded
      </div>
    );
  }

  const imageAsset = isImageAsset(url);
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
          {title}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[#98E32F]"
        >
          Open <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      {imageAsset ? (
        <Image
          src={url}
          alt={title}
          width={480}
          height={240}
          unoptimized
          className="h-40 w-full rounded-md border border-white/10 object-cover"
        />
      ) : isPdfAsset(url) ? (
        <iframe
          title={`${title} preview`}
          src={url}
          className="h-96 w-full rounded-md border border-white/10 bg-black/40"
        />
      ) : (
        <div className="space-y-2 rounded-md border border-white/10 px-3 py-8 text-center text-sm text-white/60">
          <p>Preview is not available for this file type in the app.</p>
          <p className="text-xs text-white/45">Use Open to view the original file.</p>
        </div>
      )}
    </div>
  );
}

export default function PartnerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const routeId = params?.id;
  const partnerId = Array.isArray(routeId) ? routeId[0] : routeId;

  const [selectedZoneIdsDraft, setSelectedZoneIdsDraft] = useState<string[] | null>(
    null,
  );
  const [priorityLevelDraft, setPriorityLevelDraft] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: partner, isLoading } = useQuery({
    queryKey: ["partner", partnerId],
    queryFn: () => fetchPartner(String(partnerId)),
    enabled: Boolean(partnerId),
  });

  const { data: zoneOptions = [] } = useQuery({
    queryKey: ["zones", "wayanad"],
    queryFn: () =>
      fetchZones({ district: "Wayanad", includeInactive: false }),
  });

  const selectedZoneIds = useMemo(() => {
    if (selectedZoneIdsDraft) return selectedZoneIdsDraft;
    return (partner?.zones ?? []).map((zone) => zone._id).filter(Boolean) as string[];
  }, [partner?.zones, selectedZoneIdsDraft]);

  const priorityLevel = priorityLevelDraft ?? partner?.priorityLevel ?? 5;

  const zonesMutation = useMutation({
    mutationFn: (zoneIds: string[]) => updatePartnerZones(String(partnerId), zoneIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner", partnerId] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      setSelectedZoneIdsDraft(null);
      toast.success("Partner zones updated");
    },
    onError: () => toast.error("Failed to update zones"),
  });

  const priorityMutation = useMutation({
    mutationFn: (nextLevel: number) =>
      updatePartnerPriorityLevel(String(partnerId), nextLevel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner", partnerId] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      setPriorityLevelDraft(null);
      toast.success("Priority level updated");
    },
    onError: () => toast.error("Failed to update priority level"),
  });

  const verificationMutation = useMutation({
    mutationFn: ({
      action,
      reason,
    }: {
      action: "approve" | "reject";
      reason?: string;
    }) => verifyPartner(String(partnerId), { action, reason }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["partner", partnerId] });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast.success(
        variables.action === "approve"
          ? "Partner verified"
          : "Partner rejected",
      );
      if (variables.action === "reject") {
        setRejectionReason("");
      }
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "Failed to update verification";
      toast.error(message);
    },
  });

  const zoneCountLabel = useMemo(() => {
    if (selectedZoneIds.length === 0) return "No zone selected";
    if (selectedZoneIds.length === 1) return "1 zone selected";
    return `${selectedZoneIds.length} zones selected`;
  }, [selectedZoneIds]);

  const toggleZone = (zoneId: string) => {
    setSelectedZoneIdsDraft((prev) => {
      const current = prev ?? selectedZoneIds;
      return current.includes(zoneId)
        ? current.filter((id) => id !== zoneId)
        : [...current, zoneId];
    });
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-white/50">
        <p className="text-xl font-semibold text-white">Partner not found</p>
        <Button
          variant="outline"
          className="border-white/10 text-white hover:bg-white/5"
          onClick={() => router.push("/partners")}
        >
          Back to partners
        </Button>
      </div>
    );
  }

  const partnerPhotoUrl = partner.profilePhotoUrl ?? partner.profilePhoto;
  const licenceDocumentUrl = partner.licence?.documentUrl ?? partner.licence?.document;
  const vehicleImageUrl =
    partner.vehicle?.imageUrl ?? partner.vehicle?.image ?? partner.vehicle?.document;
  const livenessSelfieUrl =
    partner.livenessCheck?.selfieImageUrl ?? partner.livenessCheck?.selfieImage;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="border-white/10 text-white hover:bg-white/5"
            onClick={() => router.push("/partners")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-bold tracking-tight">{partner.fullName}</h2>
              <Badge variant="outline" className="border-white/10 text-white/80">
                {partner.status}
              </Badge>
            </div>
            <p className="text-sm text-white/50">Partner profile and verification</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card className="border-white/5 bg-[#002833] text-white">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 text-white/40" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">Phone</p>
                  <p>{partner.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 text-white/40" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">Email</p>
                  <p>{partner.email || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-4 w-4 text-white/40" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">Joined</p>
                  <p>
                    {partner.createdAt
                      ? new Date(partner.createdAt).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
                <p className={partner.isOnline ? "text-[#98E32F]" : "text-white/50"}>
                  {partner.isOnline ? "Online" : "Offline"}
                </p>
                <p className={partner.onDuty ? "text-cyan-300" : "text-white/50"}>
                  {partner.onDuty ? "On duty" : "Off duty"}
                </p>
                <p className="text-white/50">
                  {partner.currentAssignmentOrderId ? "Currently busy" : "Currently free"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-[#002833] text-white">
            <CardHeader>
              <CardTitle>Dispatch priority</CardTitle>
              <CardDescription className="text-white/50">
                Assignment priority level between 1 and 10
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="number"
                min={1}
                max={10}
                value={priorityLevel}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isNaN(next)) return;
                  setPriorityLevelDraft(Math.max(1, Math.min(10, next)));
                }}
                className="border-white/10 bg-[#013644] text-white"
              />
              <Button
                className="w-full bg-[#98E32F] text-[#013644] hover:bg-[#86c926]"
                disabled={priorityMutation.isPending}
                onClick={() => priorityMutation.mutate(priorityLevel)}
              >
                {priorityMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save priority
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card className="border-white/5 bg-[#002833] text-white">
            <CardHeader>
              <CardTitle>Uploaded files and images</CardTitle>
              <CardDescription className="text-white/50">
                Partner media submitted during application and KYC
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <UploadedAssetCard title="Partner photo" url={partnerPhotoUrl} />
              <UploadedAssetCard title="Liveness selfie" url={livenessSelfieUrl} />
              <UploadedAssetCard title="Licence file" url={licenceDocumentUrl} />
              <UploadedAssetCard title="Vehicle image" url={vehicleImageUrl} />
            </CardContent>
          </Card>

          <Card className="border-white/5 bg-[#002833] text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#98E32F]" />
                Delivery zones
              </CardTitle>
              <CardDescription className="text-white/50">{zoneCountLabel}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {zoneOptions.length === 0 ? (
                  <p className="text-sm text-white/40">
                    No zones configured yet. Create zones first.
                  </p>
                ) : (
                  zoneOptions.map((zone) => (
                    <label
                      key={zone._id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/5 px-3 py-2 hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={selectedZoneIds.includes(zone._id)}
                        onChange={() => toggleZone(zone._id)}
                        className="accent-[#98E32F]"
                      />
                      <span className="text-sm">
                        {zone.name}{" "}
                        <span className="text-xs text-white/50">({zone.code})</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
              <Button
                className="bg-[#98E32F] text-[#013644] hover:bg-[#86c926]"
                disabled={zonesMutation.isPending}
                onClick={() => zonesMutation.mutate([...selectedZoneIds])}
              >
                {zonesMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save zones
              </Button>
            </CardContent>
          </Card>

          <Card className="border-[#98E32F]/20 bg-[#002833] text-white">
            <CardHeader>
              <CardTitle>Verification</CardTitle>
              <CardDescription className="text-white/50">
                Review licence details and approve or reject this partner
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">Method</p>
                  <p className="uppercase">
                    {partner.licenceVerification?.method || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">Status</p>
                  <p className="uppercase">
                    {partner.licenceVerification?.status || "not_submitted"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">Licence no.</p>
                  <p>{partner.licence?.number || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">Expiry</p>
                  <p>{partner.licence?.expiry || "N/A"}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] uppercase tracking-widest text-white/40">
                    Liveness check
                  </p>
                  <p>
                    {partner.livenessCheck?.isLiveConfirmed
                      ? "confirmed"
                      : "not confirmed"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] uppercase tracking-widest text-white/40">
                    Liveness checked at
                  </p>
                  <p>
                    {partner.livenessCheck?.checkedAt
                      ? new Date(partner.livenessCheck.checkedAt).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-white/40">
                    Licence document
                  </p>
                  <UploadedAssetCard title="Licence document" url={licenceDocumentUrl} />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-white/40">
                    Other verification media
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <UploadedAssetCard title="Partner photo" url={partnerPhotoUrl} />
                    <UploadedAssetCard title="Liveness selfie" url={livenessSelfieUrl} />
                    <UploadedAssetCard title="Vehicle image / doc" url={vehicleImageUrl} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-white/40">
                  Rejection reason
                </p>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Required when rejecting..."
                  className="min-h-24 border-white/10 bg-[#013644] text-white"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="flex-1 bg-red-500 text-white hover:bg-red-600"
                  disabled={
                    verificationMutation.isPending || rejectionReason.trim().length < 5
                  }
                  onClick={() =>
                    verificationMutation.mutate({
                      action: "reject",
                      reason: rejectionReason.trim(),
                    })
                  }
                >
                  {verificationMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Reject partner
                </Button>
                <Button
                  className="flex-1 bg-[#98E32F] text-[#013644] hover:bg-[#86c926]"
                  disabled={verificationMutation.isPending}
                  onClick={() => verificationMutation.mutate({ action: "approve" })}
                >
                  {verificationMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Verify partner
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
