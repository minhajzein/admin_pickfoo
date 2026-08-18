"use client";

import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import api from "@/lib/axios";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  MoreHorizontal,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  UtensilsCrossed,
  Wallet,
  Clock,
} from "lucide-react";
import { useEffect, useState, startTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { fetchZones } from "@/lib/api/zones";
import {
  updateRestaurantAvailability,
  updateRestaurantZone,
} from "@/lib/api/restaurants";
import { ListPagination } from "@/components/ui/list-pagination";
import { DEFAULT_PAGE_SIZE, parsePaginatedResponse } from "@/lib/pagination";
import { cn } from "@/lib/utils";

interface Restaurant {
  _id: string;
  name: string;
  email: string;
  contactNumber: string;
  brandLogo?: string;
  restaurantTypes?: string[];
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    coordinates?: { lat: number; lng: number };
  };
  owner: {
    name: string;
  };
  status: string;
  isOpen?: boolean;
  isManualOverride?: boolean;
  openStatusPriority?: "schedule" | "manual";
  createdAt: string;
  legalDocs: {
    fssaiLicenseNumber: string;
    gstNumber?: string;
  };
  verificationNotes?: string;
  zone?: { _id: string; name: string; code: string } | null;
}

export default function RestaurantsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<Restaurant | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["restaurants", debouncedSearch, page],
    queryFn: async () => {
      const response = await api.get(`/restaurants`, {
        params: {
          search: debouncedSearch || undefined,
          page,
          limit: DEFAULT_PAGE_SIZE,
        },
      });
      return parsePaginatedResponse<Restaurant>(response.data);
    },
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["restaurants"] });
    };
    window.addEventListener("admin:restaurant-open-updated", refresh);
    return () =>
      window.removeEventListener("admin:restaurant-open-updated", refresh);
  }, [queryClient]);

  const restaurants = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const { data: zoneOptions = [] } = useQuery({
    queryKey: ["zones", "wayanad"],
    queryFn: () =>
      fetchZones({ district: "Wayanad", includeInactive: false }),
  });

  const updateZoneMutation = useMutation({
    mutationFn: async ({
      id,
      zoneId,
    }: {
      id: string;
      zoneId: string | null;
    }) => {
      return updateRestaurantZone(id, zoneId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      toast.success("Delivery zone updated");
    },
    onError: () => toast.error("Failed to update zone"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await api.put(`/restaurants/${id}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      toast.success("Restaurant status updated successfully");
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const availabilityMutation = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action:
        | { isOpen: boolean }
        | { resetOverride: true }
        | { openStatusPriority: "schedule" | "manual" };
    }) => updateRestaurantAvailability(id, action),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      if ("resetOverride" in vars.action) {
        toast.success("Returned to schedule");
      } else if ("openStatusPriority" in vars.action) {
        toast.success(
          vars.action.openStatusPriority === "schedule"
            ? "Schedule has priority"
            : "Manual open/close has priority",
        );
      } else {
        toast.success(
          vars.action.isOpen ? "Restaurant marked open" : "Restaurant marked closed",
        );
      }
    },
    onError: () => toast.error("Failed to update shop status"),
  });

  const pendingAvailabilityId =
    availabilityMutation.isPending && availabilityMutation.variables
      ? availabilityMutation.variables.id
      : null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/80">
            Active
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">
            Pending
          </Badge>
        );
      case "suspended":
        return <Badge variant="destructive">Suspended</Badge>;
      case "inactive":
        return (
          <Badge variant="outline" className="text-white/40 border-white/10">
            Inactive
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const renderShopControls = (restaurant: Restaurant) => {
    if (restaurant.status !== "active") {
      return (
        <Badge variant="outline" className="border-white/10 text-white/35">
          N/A
        </Badge>
      );
    }

    const busy = pendingAvailabilityId === restaurant._id;
    const isOpen = Boolean(restaurant.isOpen);

    return (
      <div className="flex flex-col gap-1.5 min-w-[7.5rem]">
        <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/20 p-0.5">
          <button
            type="button"
            disabled={busy || isOpen}
            onClick={() => {
              startTransition(() => {
                availabilityMutation.mutate({
                  id: restaurant._id,
                  action: { isOpen: true },
                });
              });
            }}
            className={cn(
              "flex-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50",
              isOpen
                ? "bg-[#98E32F] text-[#013644]"
                : "text-white/55 hover:bg-white/5 hover:text-white",
            )}
          >
            Open
          </button>
          <button
            type="button"
            disabled={busy || !isOpen}
            onClick={() => {
              startTransition(() => {
                availabilityMutation.mutate({
                  id: restaurant._id,
                  action: { isOpen: false },
                });
              });
            }}
            className={cn(
              "flex-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50",
              !isOpen
                ? "bg-red-500/90 text-white"
                : "text-white/55 hover:bg-white/5 hover:text-white",
            )}
          >
            Close
          </button>
        </div>
        {restaurant.isManualOverride ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              startTransition(() => {
                availabilityMutation.mutate({
                  id: restaurant._id,
                  action: { resetOverride: true },
                });
              });
            }}
            className="text-left text-[10px] text-[#98E32F]/80 hover:text-[#98E32F] hover:underline disabled:opacity-50"
          >
            {restaurant.openStatusPriority === "manual"
              ? "Manual · use schedule"
              : "Temp override · resume"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const next =
                restaurant.openStatusPriority === "manual"
                  ? "schedule"
                  : "manual";
              startTransition(() => {
                availabilityMutation.mutate({
                  id: restaurant._id,
                  action: { openStatusPriority: next },
                });
              });
            }}
            className="text-left text-[10px] text-white/35 hover:text-white/70"
          >
            {restaurant.openStatusPriority === "manual"
              ? "Priority · manual"
              : "Priority · schedule"}
          </button>
        )}
        <Link
          href={`/restaurants/verify/${restaurant._id}#schedule`}
          className="text-left text-[10px] text-white/35 hover:text-[#98E32F]"
        >
          Edit hours
        </Link>
      </div>
    );
  };
  const liveLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Restaurants</h2>
          <p className="text-white/50 text-sm">
            Manage and verify restaurant partners
            {liveLabel ? (
              <span className="ml-2 text-white/35">
                · shop status live · updated {liveLabel}
                {isFetching ? "…" : ""}
              </span>
            ) : null}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder="Search restaurants..."
            className="pl-9 bg-[#002833] border-white/10 text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="bg-[#002833] border-white/5 text-white overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/60">Restaurant</TableHead>
                <TableHead className="text-white/60">Owner</TableHead>
                <TableHead className="text-white/60">Location</TableHead>
                <TableHead className="text-white/60">Zone</TableHead>
                <TableHead className="text-white/60">Shop</TableHead>
                <TableHead className="text-white/60">Status</TableHead>
                <TableHead className="text-white/60">Joined</TableHead>
                <TableHead className="text-right text-white/60">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-[#98E32F]"></div>
                      <span className="text-white/40">
                        Loading restaurants...
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : restaurants.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-white/40"
                  >
                    No restaurants found
                  </TableCell>
                </TableRow>
              ) : (
                restaurants.map((restaurant: Restaurant) => (
                  <TableRow
                    key={restaurant._id}
                    className="border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gray-800 flex items-center justify-center font-bold text-xs">
                          {restaurant.name[0]}
                        </div>
                        <div className="flex flex-col">
                          <span>{restaurant.name}</span>
                          <span className="text-[10px] text-white/40">
                            {restaurant.email}
                          </span>
                          {(restaurant.restaurantTypes?.length ?? 0) > 0 && (
                            <span className="text-[10px] text-white/35 capitalize">
                              {restaurant.restaurantTypes!
                                .map((t) => t.replace(/_/g, " "))
                                .join(" · ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{restaurant.owner?.name || "Unknown"}</TableCell>
                    <TableCell>{restaurant.address.city}</TableCell>
                    <TableCell
                      className="max-w-[160px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col gap-1">
                        <select
                          value={restaurant.zone?._id ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateZoneMutation.mutate({
                              id: restaurant._id,
                              zoneId: v ? v : null,
                            });
                          }}
                          disabled={updateZoneMutation.isPending}
                          className="w-full rounded-md border border-white/10 bg-[#013644] px-2 py-1.5 text-xs text-white focus:border-[#98E32F]/50 focus:outline-none"
                        >
                          <option value="">None</option>
                          {zoneOptions.map((z) => (
                            <option key={z._id} value={z._id}>
                              {z.name} ({z.lsgiCode || z.pincode || z.code})
                            </option>
                          ))}
                        </select>
                        {restaurant.address.coordinates &&
                          !restaurant.zone && (
                            <span className="text-[10px] text-amber-400/90">
                              Has map pin — pick a zone
                            </span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>{renderShopControls(restaurant)}</TableCell>
                    <TableCell>{getStatusBadge(restaurant.status)}</TableCell>
                    <TableCell className="text-white/40 font-mono text-xs">
                      {new Date(restaurant.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-[#98E32F]/10 hover:text-[#98E32F]"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-[#002833] border-white/5 text-white"
                        >
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedRestaurant(restaurant);
                              setIsViewOpen(true);
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <Link href={`/restaurants/${restaurant._id}/menu`}>
                            <DropdownMenuItem className="text-[#98E32F] focus:text-[#98E32F] focus:bg-[#98E32F]/10">
                              <UtensilsCrossed className="mr-2 h-4 w-4" />{" "}
                              Manage Menu
                            </DropdownMenuItem>
                          </Link>
                          <Link href={`/restaurants/${restaurant._id}/ledger`}>
                            <DropdownMenuItem className="text-[#98E32F] focus:text-[#98E32F] focus:bg-[#98E32F]/10">
                              <Wallet className="mr-2 h-4 w-4" /> Ledger &
                              payments
                            </DropdownMenuItem>
                          </Link>
                          <Link href={`/restaurants/verify/${restaurant._id}`}>
                            <DropdownMenuItem>
                              <ShieldCheck className="mr-2 h-4 w-4" /> Verify
                              Documents
                            </DropdownMenuItem>
                          </Link>
                          <Link href={`/restaurants/verify/${restaurant._id}#schedule`}>
                            <DropdownMenuItem className="text-[#98E32F] focus:text-[#98E32F] focus:bg-[#98E32F]/10">
                              <Clock className="mr-2 h-4 w-4" /> Manage
                              schedule
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuSeparator className="bg-white/5" />
                          {restaurant.status !== "active" && (
                            <DropdownMenuItem
                              className="text-[#98E32F] focus:text-[#98E32F] focus:bg-[#98E32F]/10"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: restaurant._id,
                                  status: "active",
                                })
                              }
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                            </DropdownMenuItem>
                          )}
                          {restaurant.status !== "suspended" && (
                            <DropdownMenuItem
                              className="text-red-400 focus:text-red-400 focus:bg-red-400/10"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: restaurant._id,
                                  status: "suspended",
                                })
                              }
                            >
                              <AlertCircle className="mr-2 h-4 w-4" /> Suspend
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="bg-white/5" />
                          <DropdownMenuItem className="text-red-500 focus:text-red-500 focus:bg-red-500/10">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <ListPagination
            page={page}
            limit={DEFAULT_PAGE_SIZE}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="bg-[#002833] border-white/5 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {selectedRestaurant?.name}
            </DialogTitle>
            <DialogDescription className="text-white/40">
              Complete restaurant details and legal documentation
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div>
                <Label className="text-white/40">Business Information</Label>
                <div className="mt-1 space-y-1">
                  <p className="text-sm">
                    <span className="text-white/20 mr-2">Email:</span>
                    {selectedRestaurant?.email}
                  </p>
                  <p className="text-sm">
                    <span className="text-white/20 mr-2">Phone:</span>
                    {selectedRestaurant?.contactNumber}
                  </p>
                  <p className="text-sm">
                    <span className="text-white/20 mr-2">Address:</span>
                    {selectedRestaurant?.address.street},{" "}
                    {selectedRestaurant?.address.city}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-white/40">Legal IDs</Label>
                <div className="mt-1 space-y-1">
                  <p className="text-sm">
                    <span className="text-white/20 mr-2">FSSAI:</span>
                    {selectedRestaurant?.legalDocs.fssaiLicenseNumber}
                  </p>
                  <p className="text-sm">
                    <span className="text-white/20 mr-2">GST:</span>
                    {selectedRestaurant?.legalDocs.gstNumber || "N/A"}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-white/40">Status History</Label>
                <div className="mt-1 flex items-center gap-2">
                  {selectedRestaurant &&
                    getStatusBadge(selectedRestaurant.status)}
                  <span className="text-[10px] text-white/20 italic">
                    Last updated: Recently
                  </span>
                </div>
              </div>
              {selectedRestaurant?.verificationNotes && (
                <div>
                  <Label className="text-white/40">Notes</Label>
                  <p className="text-sm text-white/70 mt-1 italic">
                    {selectedRestaurant.verificationNotes}
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsViewOpen(false)}
              className="border-white/10 hover:bg-white/5"
            >
              Close
            </Button>
            {selectedRestaurant?.status === "pending" && (
              <Button
                className="bg-[#98E32F] text-[#013644] hover:bg-[#86c926]"
                onClick={() => {
                  updateStatusMutation.mutate({
                    id: selectedRestaurant._id,
                    status: "active",
                  });
                  setIsViewOpen(false);
                }}
              >
                Approve Now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
