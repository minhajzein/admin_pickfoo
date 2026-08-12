"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";
import { fetchAdminUserDetails } from "@/lib/api/users";
import { fetchCustomerPaymentSummary } from "@/lib/api/customer-payments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function inr(n: number | undefined | null) {
  return `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function UserDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const userId = String(id ?? "");

  const {
    data: user,
    isLoading: isUserLoading,
    isError: isUserError,
  } = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => fetchAdminUserDetails(userId),
    enabled: !!userId,
  });

  const { data: paymentSummary } = useQuery({
    queryKey: ["customer-payments", userId],
    queryFn: () => fetchCustomerPaymentSummary(userId),
    enabled: !!userId,
  });

  if (isUserLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-white/40">
        <Loader2 className="animate-spin text-[#98E32F]" size={40} />
        <p className="font-medium animate-pulse">Loading customer details...</p>
      </div>
    );
  }

  if (isUserError || !user) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-white/50">
        <XCircle className="text-red-400" size={40} />
        <p>Could not load this customer.</p>
        <Button
          variant="outline"
          className="border-white/20"
          onClick={() => router.push("/users")}
        >
          Back to users
        </Button>
      </div>
    );
  }

  const stats = user.orderStats;
  const payments = paymentSummary?.summary;
  const joinedAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-IN") : "—";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="-ml-2 h-8 px-2 text-white/50 hover:text-white"
            onClick={() => router.push("/users")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Users
          </Button>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#98E32F]/20 bg-gradient-to-br from-[#98E32F]/20 to-[#98E32F]/10 text-xl font-bold text-[#98E32F]">
              {(user.name || "?")[0]}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {user.name || "Customer"}
                </h1>
                <Badge
                  variant="outline"
                  className="border-white/15 text-white/70"
                >
                  {user.role || "user"}
                </Badge>
                {stats.hasCompletedOrder ? (
                  <Badge className="border border-sky-400/30 bg-sky-500/15 text-sky-200">
                    Has completed order
                  </Badge>
                ) : null}
                {user.isVerified ? (
                  <Badge className="border border-[#98E32F]/25 bg-[#98E32F]/10 text-[#98E32F]">
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-red-500/25 bg-red-500/10 text-red-300">
                    Unverified
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-white/50">
                {user.externalUserId || user._id}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/users/${userId}/payments`}>
                  <Button className="bg-[#98E32F] font-semibold text-[#013644] hover:brightness-110">
                    <Wallet className="mr-2 h-4 w-4" />
                    Payments & refunds
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-0 bg-[#98E32F] text-[#013644]">
          <CardContent className="p-5">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
              Total orders
            </p>
            <p className="mt-2 text-3xl font-black">{stats.totalOrders}</p>
            <p className="mt-2 text-[11px] opacity-70">
              Completed {stats.completedOrders} · Cancelled {stats.cancelledOrders}
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/5 text-white">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Platform commission earned
            </p>
            <p className="mt-2 text-2xl font-bold text-amber-200">
              {inr(stats.totalCommissionEarned)}
            </p>
            <p className="mt-2 text-[11px] text-white/35">
              From delivered orders only
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/5 text-white">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Total paid
            </p>
            <p className="mt-2 text-2xl font-bold">
              {inr(payments?.totalPaid)}
            </p>
            <p className="mt-2 text-[11px] text-white/35">
              {payments?.paidCount ?? 0} captured payments
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/5 text-white">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Refunded
            </p>
            <p className="mt-2 text-2xl font-bold text-sky-200">
              {inr(payments?.totalRefunded)}
            </p>
            <p className="mt-2 text-[11px] text-white/35">
              {payments?.refundedCount ?? 0} refunds
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border-white/10 bg-white/5 text-white xl:col-span-2">
          <CardContent className="space-y-4 p-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                Contact
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </p>
                  <p className="mt-2 text-sm text-white/80">{user.email || "—"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
                    <Phone className="h-3.5 w-3.5" /> Phone
                  </p>
                  <p className="mt-2 text-sm text-white/80">{user.phone || "—"}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                Default delivery address
              </p>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-4">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
                  <MapPin className="h-3.5 w-3.5" />
                  {user.defaultDeliveryAddress?.label || "Saved address"}
                </p>
                <p className="mt-2 text-sm text-white/80">
                  {user.defaultDeliveryAddress?.formattedAddress || "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 text-white">
          <CardContent className="space-y-4 p-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                Account
              </p>
              <div className="mt-3 space-y-3 text-sm text-white/75">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/45">Joined</span>
                  <span>{joinedAt}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/45">Last order</span>
                  <span>{formatDate(stats.lastOrderAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/45">Failed payments</span>
                  <span>{payments?.failedCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/45">Pending checkouts</span>
                  <span>{payments?.pendingCount ?? 0}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                Recent searches
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.isArray(user.recentSearches) && user.recentSearches.length > 0 ? (
                  user.recentSearches.slice(0, 8).map((term) => (
                    <Badge
                      key={term}
                      variant="outline"
                      className="border-white/15 bg-black/10 text-white/70"
                    >
                      <Search className="mr-1 h-3 w-3" />
                      {term}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-white/45">No recent searches saved.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
