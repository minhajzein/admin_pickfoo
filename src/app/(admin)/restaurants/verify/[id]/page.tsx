"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileText,
  ExternalLink,
  MapPin,
  Phone,
  Mail,
  Store,
  User,
  Calendar,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import NextImage from "next/image";

const DocumentCard = ({
  title,
  url,
  number,
}: {
  title: string;
  url?: string;
  number?: string;
}) => {
  const isImage = url?.match(/\.(jpg|jpeg|png|webp|gif)$/i);

  return (
    <Card className="bg-white/5 border-white/10 overflow-hidden group text-white">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileText size={16} className="text-[#98E32F]" />
            {title}
          </CardTitle>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 hover:bg-[#98E32F]/10 rounded-lg text-white/40 hover:text-[#98E32F] transition-all"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
        {number && (
          <p className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-widest">
            ID: {number}
          </p>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {url ? (
          <div className="relative aspect-video rounded-xl bg-black/40 overflow-hidden border border-white/5">
            {isImage ? (
              <NextImage
                src={url}
                alt={title}
                width={400}
                height={225}
                unoptimized
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/20">
                <FileText size={32} />
                <span className="text-xs">PDF Document</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#98E32F] text-[#013644] rounded-lg font-bold text-xs flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform"
              >
                View Full Document
              </a>
            </div>
          </div>
        ) : (
          <div className="aspect-video rounded-xl bg-white/5 flex flex-col items-center justify-center gap-2 border border-dashed border-white/10 text-white/20">
            <AlertCircle size={24} />
            <span className="text-[10px] uppercase font-bold tracking-widest">
              Not Provided
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function VerifyRestaurantPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant", id],
    queryFn: async () => {
      const response = await api.get(`/restaurants/${id}`);
      return response.data.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      status,
      verificationNotes,
    }: {
      status: string;
      verificationNotes: string;
    }) => {
      const response = await api.put(`/restaurants/${id}/status`, {
        status,
        verificationNotes,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["restaurant", id] });
      toast.success(
        `Restaurant ${variables.status === "active" ? "approved" : "rejected"} successfully`,
      );
      router.push("/restaurants");
    },
    onError: () => {
      toast.error("Failed to update restaurant status");
    },
  });

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-white/40">
        <Loader2 className="animate-spin text-[#98E32F]" size={40} />
        <p className="font-medium animate-pulse">
          Fetching restaurant profile...
        </p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-white/40">
        <XCircle size={48} className="text-red-500/50" />
        <p className="font-bold text-xl">Restaurant not found</p>
        <Button
          onClick={() => router.push("/restaurants")}
          variant="outline"
          className="border-white/10"
        >
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/restaurants")}
            className="rounded-2xl bg-white/5 border border-white/10 hover:bg-[#98E32F]/10 hover:text-[#98E32F] transition-all"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black">{restaurant.name}</h1>
              <Badge
                className={
                  restaurant.status === "active"
                    ? "bg-[#98E32F] text-[#013644]"
                    : restaurant.status === "pending"
                      ? "bg-yellow-500 text-white"
                      : "bg-red-500 text-white"
                }
              >
                {restaurant.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-white/40 text-sm mt-1 uppercase tracking-widest font-bold">
              Verification Dashboard
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Details & Contact */}
        <div className="lg:col-span-1 space-y-8">
          {/* Logo/Image */}
          <Card className="bg-[#002833] border-white/5 overflow-hidden text-white">
            <div className="relative h-48 bg-black/20">
              {restaurant.image ? (
                <NextImage
                  src={restaurant.image}
                  alt={restaurant.name}
                  width={400}
                  height={192}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/10">
                  <Store size={48} />
                  <span className="text-xs font-bold uppercase tracking-widest">
                    No Brand Image
                  </span>
                </div>
              )}
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white/5 rounded-xl text-white/40 group-hover:text-[#98E32F] transition-colors">
                  <Mail size={16} />
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase font-black tracking-widest">
                    Business Email
                  </p>
                  <p className="text-sm font-medium">{restaurant.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white/5 rounded-xl text-white/40 group-hover:text-[#98E32F] transition-colors">
                  <Phone size={16} />
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase font-black tracking-widest">
                    Phone Number
                  </p>
                  <p className="text-sm font-medium">
                    {restaurant.contactNumber}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white/5 rounded-xl text-white/40 group-hover:text-[#98E32F] transition-colors">
                  <MapPin size={16} />
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase font-black tracking-widest">
                    Location
                  </p>
                  <p className="text-sm font-medium leading-relaxed">
                    {restaurant.address.street},<br />
                    {restaurant.address.city}, {restaurant.address.state}
                    <br />
                    {restaurant.address.zipCode}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Owner Details */}
          <Card className="bg-[#002833] border-white/5 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <User size={20} className="text-[#98E32F]" />
                Owner Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-[10px] text-white/30 uppercase font-black tracking-widest">
                  Full Name
                </p>
                <p className="text-sm font-medium">
                  {restaurant.owner?.name || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase font-black tracking-widest">
                  Joined Platform
                </p>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar size={14} className="text-white/20" />
                  {new Date(restaurant.createdAt).toLocaleDateString(
                    undefined,
                    { dateStyle: "long" },
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Documents & Review */}
        <div className="lg:col-span-2 space-y-8">
          <section>
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-xl font-bold">Legal Documents</h2>
              <div className="h-px flex-1 bg-white/5"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DocumentCard
                title="FSSAI Certificate"
                url={restaurant.legalDocs.fssaiCertificateUrl}
                number={restaurant.legalDocs.fssaiLicenseNumber}
              />
              <DocumentCard
                title="GST Certificate"
                url={restaurant.legalDocs.gstCertificateUrl}
                number={restaurant.legalDocs.gstNumber}
              />
              <DocumentCard
                title="Trade License"
                url={restaurant.legalDocs.tradeLicenseUrl}
                number={restaurant.legalDocs.tradeLicenseNumber}
              />
              <DocumentCard
                title="Health Certificate"
                url={restaurant.legalDocs.healthCertificateUrl}
              />
              <DocumentCard
                title="PAN Card / Number"
                number={restaurant.legalDocs.panNumber}
              />
            </div>
          </section>

          {/* Review Action */}
          <Card className="bg-[#002833] border-[#98E32F]/20 border-2 overflow-hidden shadow-[0_0_50px_rgba(152,227,47,0.05)]">
            <CardHeader className="bg-[#98E32F]/5 border-b border-[#98E32F]/10">
              <CardTitle className="text-lg">Assessment & Action</CardTitle>
              <CardDescription className="text-white/40">
                Provide feedback and update verification status
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                  Verification Notes
                </label>
                <Textarea
                  placeholder="Reason for approval/rejection or things that need improvement..."
                  className="bg-black/20 border-white/5 focus:border-[#98E32F]/50 h-32 resize-none text-sm p-4 text-white"
                  value={notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setNotes(e.target.value)
                  }
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Button
                  className="flex-1 h-14 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all rounded-2xl font-bold flex items-center justify-center gap-2 group"
                  disabled={updateStatusMutation.isPending}
                  onClick={() =>
                    updateStatusMutation.mutate({
                      status: "rejected",
                      verificationNotes: notes,
                    })
                  }
                >
                  <XCircle
                    size={20}
                    className="group-hover:scale-110 transition-transform"
                  />
                  Reject Restaurant
                </Button>
                <Button
                  className="flex-[1.5] h-14 bg-[#98E32F] text-[#013644] hover:bg-[#86c926] transition-all rounded-2xl font-black text-lg shadow-[0_10px_30px_rgba(152,227,47,0.2)] flex items-center justify-center gap-2 group"
                  disabled={updateStatusMutation.isPending}
                  onClick={() =>
                    updateStatusMutation.mutate({
                      status: "active",
                      verificationNotes: notes,
                    })
                  }
                >
                  {updateStatusMutation.isPending ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    <>
                      <CheckCircle2
                        size={24}
                        className="group-hover:scale-110 transition-transform"
                      />
                      Approve Business
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
