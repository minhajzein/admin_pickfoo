"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";
import {
  LayoutDashboard,
  Store,
  Users,
  ClipboardList,
  Wallet,
  Star,
  LogOut,
  Menu as MenuIcon,
  X,
  CheckCircle2,
  MapPinned,
  Map,
  Bike,
  Activity,
  Headset,
  ImageIcon,
  Bell,
} from "lucide-react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isInitialized, logout, initialize } =
    useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      void initialize();
    }
  }, [isInitialized, initialize]);

  useLayoutEffect(() => {
    if (!isInitialized) return;
    if (!isAuthenticated || user?.role !== "admin") {
      router.replace("/login");
    }
  }, [isInitialized, isAuthenticated, user, router]);

  useEffect(() => {
    const timer = setTimeout(() => setIsMobileMenuOpen(false), 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Real-time notifications
  useEffect(() => {
    if (!isAuthenticated) return;

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "https://api.pickfoo.in";
    const socketPath =
      process.env.NEXT_PUBLIC_SOCKET_IO_PATH || "/admin/socket.io";
    const socket = io(socketUrl, {
      path: socketPath,
      withCredentials: true,
    });

    socket.on("connect", () => {
      console.log("Connected to notification service:", socket.id);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    socket.on("new-restaurant-verification", (data: { message: string }) => {
      toast.message("New Verification Request", {
        description: data.message,
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        action: {
          label: "View",
          onClick: () => router.push("/restaurants"),
        },
        duration: 8000,
      });
      // Optionally play a sound
      const audio = new Audio("/notification.mp3"); // Ensure this file exists or use a default browser sound logic (which requires user interaction usually)
      audio.play().catch(() => {});
    });

    socket.on(
      "dispatch:partner-assigned",
      (data: {
        orderId?: string;
        pickfooId?: string | null;
        partnerName?: string;
      }) => {
        const orderRef = data.pickfooId || data.orderId || "order";
        const partner = data.partnerName || "Partner";
        toast.success("Partner assigned live", {
          description: `${partner} assigned to ${orderRef}`,
          duration: 6000,
          action: {
            label: "Partners",
            onClick: () => router.push("/partners"),
          },
        });
        window.dispatchEvent(
          new CustomEvent("admin:dispatch-updated", {
            detail: { type: "assigned", payload: data },
          }),
        );
      },
    );

    socket.on(
      "dispatch:no-partner-available",
      (data: { orderRef?: string; reason?: string }) => {
        toast.warning("No partner available", {
          description: `${data.orderRef || "Order"}: ${data.reason || "Try again shortly."}`,
          duration: 7000,
        });
        window.dispatchEvent(
          new CustomEvent("admin:dispatch-updated", {
            detail: { type: "no-partner", payload: data },
          }),
        );
      },
    );

    socket.on(
      "dispatch:partner-lock-released",
      (data: { orderRef?: string }) => {
        window.dispatchEvent(
          new CustomEvent("admin:dispatch-updated", {
            detail: { type: "released", payload: data },
          }),
        );
      },
    );

    socket.on(
      "order:live:new-request",
      (data: { orderId?: string; orderType?: string }) => {
        toast.message("New live order request", {
          description: `${data.orderId || "Order"} (${data.orderType || "delivery"})`,
          duration: 6000,
          action: {
            label: "Orders",
            onClick: () => router.push("/orders"),
          },
        });
      },
    );

    socket.on(
      "order:live:status-updated",
      (data: { orderId?: string; status?: string }) => {
        toast.message("Order status live update", {
          description: `${data.orderId || "Order"} -> ${data.status || "updated"}`,
          duration: 5000,
          action: {
            label: "Orders",
            onClick: () => router.push("/orders"),
          },
        });
      },
    );

    socket.on(
      "order:live:customer-cancelled",
      (data: { orderId?: string; reason?: string }) => {
        toast.warning("Customer cancelled order", {
          description: `${data.orderId || "Order"}: ${data.reason || "cancelled"}`,
          duration: 7000,
          action: {
            label: "Orders",
            onClick: () => router.push("/orders"),
          },
        });
      },
    );

    socket.on("support:message", (data: unknown) => {
      window.dispatchEvent(
        new CustomEvent("admin:support-message", { detail: data }),
      );
    });

    socket.on("support:thread:updated", (data: unknown) => {
      window.dispatchEvent(
        new CustomEvent("admin:support-thread-updated", { detail: data }),
      );
    });

    socket.on("monitor:event", (data: unknown) => {
      window.dispatchEvent(
        new CustomEvent("admin:monitor-event", {
          detail: data,
        }),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, router]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[#013644] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#98E32F]" />
      </div>
    );
  }

  if (!isAuthenticated || !user || user.role !== "admin") {
    return null;
  }

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard, href: "/" },
    { name: "Restaurants", icon: Store, href: "/restaurants" },
    { name: "Banners", icon: ImageIcon, href: "/banners" },
    { name: "Zones", icon: MapPinned, href: "/zones" },
    { name: "Live map", icon: Map, href: "/map" },
    { name: "Partners", icon: Bike, href: "/partners" },
    { name: "Support", icon: Headset, href: "/support" },
    { name: "Partner updates", icon: Bell, href: "/partner-updates" },
    { name: "Gigs", icon: ClipboardList, href: "/gigs" },
    { name: "Monitor", icon: Activity, href: "/monitor" },
    { name: "Users", icon: Users, href: "/users" },
    { name: "Orders", icon: ClipboardList, href: "/orders" },
    { name: "Company income", icon: Wallet, href: "/revenue" },
    { name: "Reviews", icon: Star, href: "/reviews" },
  ];

  return (
    <div className="h-dvh bg-[#013644] text-white flex overflow-hidden dark">
      <Toaster position="top-right" richColors />
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 bg-[#002833] border-r border-white/5 flex flex-col
          transition-[width,transform] duration-300 ease-in-out
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          lg:relative lg:translate-x-0
          ${isSidebarOpen ? "w-64" : "w-20"}
        `}
      >
        <div className="p-6 h-20 flex items-center relative overflow-hidden">
          {/* Logo - Expanded State */}
          <div
            className={`transition-all duration-300 ease-in-out ${isSidebarOpen || isMobileMenuOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10 pointer-events-none"}`}
          >
            <Link href="/" className="relative h-10 w-32 block">
              <Image
                src="/logo.png"
                alt="Pickfoo"
                fill
                className="object-contain"
                priority
              />
              <span className="text-[8px] absolute -bottom-1 left-0 opacity-60 font-black tracking-widest text-[#98E32F]">
                ADMIN
              </span>
            </Link>
          </div>

          <div
            className={`absolute left-5 transition-all duration-300 ease-in-out ${!isSidebarOpen && !isMobileMenuOpen ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none"}`}
          >
            <Link
              href="/"
              className="w-10 h-10 flex items-center justify-center relative"
            >
              <Image
                src="/logo.png"
                alt="P"
                width={32}
                height={32}
                className="object-contain"
              />
            </Link>
          </div>

          {/* Mobile close button */}
          {isMobileMenuOpen && (
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-2 absolute right-6 hover:bg-white/5 rounded-lg text-[#98E32F]"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center p-3 rounded-xl transition-all duration-300 group relative ${
                  isActive
                    ? "bg-[#98E32F] text-[#013644] shadow-[0_0_20px_rgba(152,227,47,0.2)]"
                    : "hover:bg-[#98E32F]/10 hover:text-[#98E32F] text-white/60"
                }`}
              >
                <div
                  className={`flex items-center justify-center transition-all duration-300 ${isSidebarOpen || isMobileMenuOpen ? "w-auto" : "w-full"}`}
                >
                  <item.icon
                    size={22}
                    className={`min-w-[22px] transition-transform duration-300 ${isActive ? "scale-110" : ""}`}
                  />
                </div>
                <span
                  className={`font-bold text-sm tracking-tight whitespace-nowrap transition-all duration-300 overflow-hidden ${
                    isSidebarOpen || isMobileMenuOpen
                      ? "opacity-100 max-w-[200px] ml-4"
                      : "opacity-0 max-w-0 ml-0"
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={() => logout()}
            className="w-full flex items-center p-3 rounded-xl hover:bg-red-500/10 text-red-400 transition-all duration-300"
          >
            <div
              className={`flex items-center justify-center transition-all duration-300 ${isSidebarOpen || isMobileMenuOpen ? "w-auto" : "w-full"}`}
            >
              <LogOut size={22} className="min-w-[22px]" />
            </div>
            <span
              className={`font-medium whitespace-nowrap transition-all duration-300 overflow-hidden ${
                isSidebarOpen || isMobileMenuOpen
                  ? "opacity-100 max-w-[200px] ml-4"
                  : "opacity-0 max-w-0 ml-0"
              }`}
            >
              Logout
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-white/5 bg-[#013644]/50 backdrop-blur-md sticky top-0 z-10 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex p-2 -ml-2 hover:bg-white/5 rounded-lg text-[#98E32F]"
            >
              <MenuIcon size={24} />
            </button>

            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 hover:bg-white/5 rounded-lg text-[#98E32F]"
            >
              <MenuIcon size={24} />
            </button>
            <h1 className="text-lg sm:text-xl font-semibold truncate">
              {navItems.find((item) => item.href === pathname)?.name ||
                "Admin Panel"}
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-none mb-1">
                {user.name}
              </p>
              <p className="text-[10px] text-[#98E32F] uppercase tracking-widest font-black leading-none">
                Super Admin
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#98E32F] to-[#7dbb26] flex items-center justify-center text-[#013644] font-bold">
              {user.name[0]}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="p-4 sm:p-8 max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
