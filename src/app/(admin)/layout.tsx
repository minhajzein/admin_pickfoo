"use client";

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type ComponentType,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import {
  LayoutDashboard,
  Store,
  Users,
  ClipboardList,
  Wallet,
  Banknote,
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
  Clapperboard,
  Bell,
  Gift,
  IndianRupee,
  Loader2,
} from "lucide-react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  adminShellUi,
  useAdminShellUi,
} from "@/components/admin/admin-shell-ui";

const NAV_ITEMS: Array<{
  name: string;
  href: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}> = [
  { name: "Dashboard", icon: LayoutDashboard, href: "/" },
  { name: "Restaurants", icon: Store, href: "/restaurants" },
  { name: "Banners", icon: ImageIcon, href: "/banners" },
  { name: "Home Videos", icon: Clapperboard, href: "/home-videos" },
  { name: "Zones", icon: MapPinned, href: "/zones" },
  { name: "Live map", icon: Map, href: "/map" },
  { name: "Partners", icon: Bike, href: "/partners" },
  { name: "Support", icon: Headset, href: "/support" },
  { name: "Partner updates", icon: Bell, href: "/partner-updates" },
  { name: "Partner incentives", icon: Gift, href: "/partner-incentives" },
  { name: "Customer offers", icon: Gift, href: "/customer-offers" },
  { name: "Delivery charges", icon: IndianRupee, href: "/delivery-charges" },
  { name: "Gigs", icon: ClipboardList, href: "/gigs" },
  { name: "Monitor", icon: Activity, href: "/monitor" },
  { name: "Users", icon: Users, href: "/users" },
  { name: "Orders", icon: ClipboardList, href: "/orders" },
  { name: "Platform ledger", icon: Wallet, href: "/revenue" },
  { name: "Withdrawals", icon: Banknote, href: "/withdrawals" },
  { name: "Partner payouts", icon: Banknote, href: "/partner-withdrawals" },
  { name: "Reviews", icon: Star, href: "/reviews" },
];

/** Isolates page content so sidebar/header UI state does not re-render it. */
const AdminPageSlot = memo(function AdminPageSlot({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-7xl p-4 sm:p-8">{children}</div>
    </div>
  );
});

const NavItemButton = memo(function NavItemButton({
  name,
  href,
  icon: Icon,
  isActive,
  isPending,
  expanded,
  onNavigate,
}: {
  name: string;
  href: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  isActive: boolean;
  isPending: boolean;
  expanded: boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <Link
      href={href}
      prefetch
      onClick={(e) => {
        e.preventDefault();
        onNavigate(href);
      }}
      className={`group relative flex w-full items-center rounded-xl p-3 text-left transition-colors duration-100 ${
        isActive || isPending
          ? "bg-[#98E32F] text-[#013644] shadow-[0_0_20px_rgba(152,227,47,0.2)]"
          : "text-white/60 hover:bg-[#98E32F]/10 hover:text-[#98E32F]"
      }`}
    >
      <div
        className={`flex items-center justify-center ${expanded ? "w-auto" : "w-full"}`}
      >
        {isPending && !isActive ? (
          <Loader2 size={22} className="min-w-[22px] animate-spin" />
        ) : (
          <Icon size={22} className="min-w-[22px]" />
        )}
      </div>
      <span
        className={`overflow-hidden whitespace-nowrap text-sm font-bold tracking-tight ${
          expanded ? "ml-4 max-w-[200px] opacity-100" : "ml-0 max-w-0 opacity-0"
        }`}
      >
        {name}
      </span>
    </Link>
  );
});

function AdminSidebar({ onLogout }: { onLogout: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { sidebarOpen, mobileOpen } = useAdminShellUi();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const navLockRef = useRef(false);
  const [, startNavTransition] = useTransition();

  useEffect(() => {
    setPendingHref(null);
    navLockRef.current = false;
  }, [pathname]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const item of NAV_ITEMS) {
        try {
          router.prefetch(item.href);
        } catch {
          // ignore prefetch failures
        }
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [router]);

  const navigate = useCallback(
    (href: string) => {
      adminShellUi.closeMobile();
      if (href === pathname || navLockRef.current) return;

      navLockRef.current = true;
      // Paint pending state in this task; push the route after the click ends.
      setPendingHref(href);

      window.setTimeout(() => {
        startNavTransition(() => {
          router.push(href);
        });
      }, 32);
    },
    [pathname, router, startNavTransition],
  );

  const expanded = sidebarOpen || mobileOpen;

  return (
    <>
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => adminShellUi.closeMobile()}
        />
      ) : null}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/5 bg-[#002833]
          transition-[width,transform] duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:relative lg:translate-x-0
          ${sidebarOpen ? "w-64" : "w-20"}
        `}
      >
        <div className="relative flex h-20 items-center overflow-hidden p-6">
          <div
            className={`${expanded ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-10 opacity-0"}`}
          >
            <Link href="/" className="relative block h-10 w-32" prefetch>
              <Image
                src="/logo.png"
                alt="Pickfoo"
                fill
                className="object-contain"
                priority
              />
              <span className="absolute -bottom-1 left-0 text-[8px] font-black tracking-widest text-[#98E32F] opacity-60">
                ADMIN
              </span>
            </Link>
          </div>

          <div
            className={`absolute left-5 ${!expanded ? "scale-100 opacity-100" : "pointer-events-none scale-50 opacity-0"}`}
          >
            <Link
              href="/"
              prefetch
              className="relative flex h-10 w-10 items-center justify-center"
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

          {mobileOpen ? (
            <button
              type="button"
              onClick={() => adminShellUi.closeMobile()}
              className="absolute right-6 rounded-lg p-2 text-[#98E32F] hover:bg-white/5 lg:hidden"
            >
              <X size={20} />
            </button>
          ) : null}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
          {NAV_ITEMS.map((item) => (
            <NavItemButton
              key={item.name}
              name={item.name}
              href={item.href}
              icon={item.icon}
              isActive={pathname === item.href}
              isPending={pendingHref === item.href}
              expanded={expanded}
              onNavigate={navigate}
            />
          ))}
        </nav>

        <div className="border-t border-white/5 p-4">
          <button
            type="button"
            onClick={() => startTransition(() => onLogout())}
            className="flex w-full items-center rounded-xl p-3 text-red-400 transition-colors duration-100 hover:bg-red-500/10"
          >
            <div
              className={`flex items-center justify-center ${expanded ? "w-auto" : "w-full"}`}
            >
              <LogOut size={22} className="min-w-[22px]" />
            </div>
            <span
              className={`overflow-hidden whitespace-nowrap font-medium ${
                expanded
                  ? "ml-4 max-w-[200px] opacity-100"
                  : "ml-0 max-w-0 opacity-0"
              }`}
            >
              Logout
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

function AdminHeader({
  userName,
  pageTitle,
}: {
  userName: string;
  pageTitle: string;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/5 bg-[#013644]/50 px-4 backdrop-blur-md sm:px-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => startTransition(() => adminShellUi.toggleSidebar())}
          className="-ml-2 hidden rounded-lg p-2 text-[#98E32F] hover:bg-white/5 lg:flex"
        >
          <MenuIcon size={24} />
        </button>

        <button
          type="button"
          onClick={() => startTransition(() => adminShellUi.openMobile())}
          className="-ml-2 rounded-lg p-2 text-[#98E32F] hover:bg-white/5 lg:hidden"
        >
          <MenuIcon size={24} />
        </button>
        <h1 className="truncate text-lg font-semibold sm:text-xl">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <div className="hidden text-right sm:block">
          <p className="mb-1 text-sm font-medium leading-none">{userName}</p>
          <p className="text-[10px] font-black uppercase leading-none tracking-widest text-[#98E32F]">
            Super Admin
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#98E32F] to-[#7dbb26] font-bold text-[#013644]">
          {userName[0]}
        </div>
      </div>
    </header>
  );
}

function useAdminRealtime(enabled: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

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
      const audio = new Audio("/notification.mp3");
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
      "restaurant:isOpen-updated",
      (data: {
        restaurantId?: string;
        name?: string | null;
        isOpen?: boolean;
        isManualOverride?: boolean;
      }) => {
        window.dispatchEvent(
          new CustomEvent("admin:restaurant-open-updated", {
            detail: data,
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

    socket.on("restaurant-message:new", (data: unknown) => {
      window.dispatchEvent(
        new CustomEvent("admin:restaurant-message", { detail: data }),
      );
    });

    socket.on("restaurant-message:thread-updated", (data: unknown) => {
      window.dispatchEvent(
        new CustomEvent("admin:restaurant-message-thread", { detail: data }),
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
  }, [enabled, router]);
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isInitialized, logout, initialize } =
    useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

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
    const timer = setTimeout(() => {
      startTransition(() => adminShellUi.closeMobile());
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  useAdminRealtime(isAuthenticated);

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#013644] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-[#98E32F]" />
          <p className="text-sm text-white/50">Loading admin…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#013644] px-4 text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-[#98E32F]" />
        <p className="text-sm text-white/70">Redirecting to login…</p>
        <Link
          href="/login"
          className="text-sm text-[#98E32F] underline-offset-2 hover:underline"
        >
          Continue to login
        </Link>
      </div>
    );
  }

  const pageTitle =
    NAV_ITEMS.find((item) => item.href === pathname)?.name || "Admin Panel";

  return (
    <div className="flex h-dvh overflow-hidden bg-[#013644] text-white dark">
      <Toaster position="top-right" richColors />
      <AdminSidebar onLogout={logout} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader userName={user.name} pageTitle={pageTitle} />
        <AdminPageSlot>{children}</AdminPageSlot>
      </main>
    </div>
  );
}
