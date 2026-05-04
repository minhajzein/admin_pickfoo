"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchMonitorEvents } from "@/lib/api/monitor";
import type { AdminMonitorEvent } from "@/types/models";
import { Loader2, MessageSquareText } from "lucide-react";

type ReviewEventRow = {
  id: string;
  event: string;
  source: string;
  rating: number | null;
  comment: string;
  createdAt: string;
};

export default function ReviewsPage() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["reviews", "monitor-events"],
    queryFn: () => fetchMonitorEvents({ limit: 300 }),
    refetchInterval: 30000,
  });

  const rows = useMemo(() => toReviewRows(events), [events]);
  const avgRating = getAverageRating(rows);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reviews</h2>
        <p className="text-sm text-white/50">
          Review moderation stream for admin visibility.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Review events</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{rows.length}</CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Average rating</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {avgRating ? avgRating.toFixed(1) : "—"}
          </CardContent>
        </Card>
        <Card className="border-white/5 bg-[#002833] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Latest update</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">
            {rows[0]?.createdAt
              ? new Date(rows[0].createdAt).toLocaleString()
              : "No review activity yet"}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-white/5 bg-[#002833] text-white">
        <CardHeader>
          <CardTitle className="text-base">Recent review events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-white/60">Event</TableHead>
                <TableHead className="text-white/60">Rating</TableHead>
                <TableHead className="text-white/60">Comment</TableHead>
                <TableHead className="text-white/60">Source</TableHead>
                <TableHead className="text-right text-white/60">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#98E32F]" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10">
                    <div className="flex flex-col items-center gap-2 text-center text-white/40">
                      <MessageSquareText className="h-6 w-6" />
                      <p>No review events have been published yet.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-white/5 hover:bg-white/5"
                  >
                    <TableCell>
                      <Badge variant="outline" className="border-white/10 text-white/80">
                        {row.event}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.rating ?? "—"}</TableCell>
                    <TableCell className="max-w-[320px] truncate text-white/80">
                      {row.comment || "No comment"}
                    </TableCell>
                    <TableCell className="text-white/50">{row.source}</TableCell>
                    <TableCell className="text-right text-xs text-white/50">
                      {new Date(row.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function toReviewRows(events: AdminMonitorEvent[]): ReviewEventRow[] {
  return events
    .filter((event) => event.event.toLowerCase().includes("review"))
    .slice(0, 80)
    .map((event) => {
      const payload = asObject(event.payload);
      return {
        id: event.id,
        event: event.event,
        source: event.source || "system",
        rating: asNumber(payload.rating),
        comment: asString(payload.comment),
        createdAt: event.createdAt,
      };
    });
}

function getAverageRating(rows: ReviewEventRow[]): number | null {
  const ratings = rows
    .map((row) => row.rating)
    .filter((value): value is number => value !== null);
  if (!ratings.length) return null;
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return total / ratings.length;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
