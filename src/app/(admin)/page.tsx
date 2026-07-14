"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchDashboardOverview } from "@/lib/api/dashboard";
import {
  Store,
  Users,
  ClipboardList,
  Wallet,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function AdminDashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: fetchDashboardOverview,
    refetchInterval: 30000,
  });

  const stats = [
    {
      title: "Total Restaurants",
      value: data?.totalRestaurants ?? 0,
      helper: `${data?.pendingRestaurantVerifications ?? 0} pending verification`,
      icon: Store,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      title: "Active Users",
      value: data?.activeUsers ?? 0,
      helper: "Verified customer accounts",
      icon: Users,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
    {
      title: "Total Orders",
      value: data?.totalOrders ?? 0,
      helper: "Orders available in database",
      icon: ClipboardList,
      color: "text-[#98E32F]",
      bg: "bg-[#98E32F]/10",
    },
    {
      title: "Platform commission",
      value: money.format(data?.platformCommission ?? 0),
      helper: `${data?.onlinePartners ?? 0} partners online`,
      icon: Wallet,
      color: "text-orange-400",
      bg: "bg-orange-400/10",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
        <p className="text-white/50">
          Live data from admin APIs across restaurants, users, orders, and
          monitor events.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="group overflow-hidden border-white/5 bg-[#002833] text-white transition-all duration-300 hover:border-[#98E32F]/30"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/60">
                {stat.title}
              </CardTitle>
              <div
                className={`${stat.bg} ${stat.color} rounded-lg p-2 transition-transform duration-300 group-hover:scale-110`}
              >
                <stat.icon size={20} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-[#98E32F]" />
                ) : (
                  stat.value
                )}
              </div>
              <p className="mt-1 text-xs text-white/40">{stat.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-white/5 bg-[#002833] text-white">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#98E32F]" />
              </div>
            ) : isError ? (
              <div className="flex items-center gap-2 py-8 text-white/50">
                <AlertCircle className="h-4 w-4 text-red-400" />
                Failed to load dashboard activity
              </div>
            ) : !data?.recentActivity?.length ? (
              <p className="py-8 text-sm text-white/40">
                No recent activity available.
              </p>
            ) : (
              <div className="space-y-6">
                {data.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
                      {activity.event.startsWith("order:") ||
                      activity.event.startsWith("dispatch:") ? (
                        <Clock size={20} className="text-blue-400" />
                      ) : (
                        <CheckCircle2 size={20} className="text-[#98E32F]" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {activity.message}
                      </p>
                      <p className="text-xs text-white/40">
                        {new Date(activity.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-white/5 bg-[#002833] text-white">
          <CardHeader>
            <CardTitle>Verification Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#98E32F]" />
              </div>
            ) : !data?.verificationQueue?.length ? (
              <p className="py-8 text-sm text-white/40">
                No pending verification requests.
              </p>
            ) : (
              <div className="space-y-4">
                {data.verificationQueue.map((restaurant) => (
                  <div
                    key={restaurant.id}
                    className="cursor-pointer rounded-xl border border-white/5 bg-white/5 p-3 transition-all hover:border-[#98E32F]/20"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{restaurant.name}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                          {restaurant.city || "Unknown city"} • Pending review
                        </p>
                      </div>
                      <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                    </div>
                  </div>
                ))}
                <Link
                  href="/restaurants"
                  className="block w-full rounded-xl border border-dashed border-white/10 py-3 text-center text-sm text-white/40 transition-all hover:border-[#98E32F]/40 hover:text-[#98E32F]"
                >
                  View All Pending Requests
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
