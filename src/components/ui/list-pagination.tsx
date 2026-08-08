"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DEFAULT_PAGE_SIZE, pageRangeLabel } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/**
 * Page size (`limit` / `pageSize`) is OPTIONAL and defaults to DEFAULT_PAGE_SIZE.
 * Do not make it required — admin list pages often omit it and rely on the default.
 */
export type ListPaginationProps = {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Page size for the range label. Defaults to DEFAULT_PAGE_SIZE. */
  pageSize?: number;
  /** Alias of pageSize (kept for existing call sites). Defaults to DEFAULT_PAGE_SIZE. */
  limit?: number;
  totalPages?: number;
  className?: string;
  /** Compact footer for dense tables */
  dense?: boolean;
};

export function ListPagination({
  page,
  pageSize,
  limit,
  total,
  totalPages: totalPagesProp,
  onPageChange,
  className = "",
  dense = false,
}: ListPaginationProps) {
  const [isPending, startTransition] = useTransition();
  const size = pageSize ?? limit ?? DEFAULT_PAGE_SIZE;
  const totalPages =
    totalPagesProp ?? Math.max(1, Math.ceil(Math.max(0, total) / size) || 1);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const goTo = (next: number) => {
    startTransition(() => {
      onPageChange(next);
    });
  };

  if (total <= 0) {
    return (
      <div
        className={`flex items-center justify-between gap-3 border-t border-white/5 px-4 ${
          dense ? "py-2" : "py-3"
        } text-xs text-white/35 ${className}`}
      >
        <span>No results</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        `flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/5 px-4 ${
          dense ? "py-2" : "py-3"
        }`,
        isPending && "opacity-80",
        className,
      )}
    >
      <p className="text-xs text-white/40">
        Showing{" "}
        <span className="text-white/70 font-medium">
          {pageRangeLabel(page, size, total)}
        </span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canPrev || isPending}
          className="border-white/15 text-white/70 disabled:opacity-30 h-8"
          onClick={() => goTo(page - 1)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Prev
        </Button>
        <span className="text-xs text-white/50 min-w-[4.5rem] text-center">
          Page {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canNext || isPending}
          className="border-white/15 text-white/70 disabled:opacity-30 h-8"
          onClick={() => goTo(page + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Compile-time lock: if `limit` or `pageSize` is ever made required again,
 * this assignment fails and the admin build breaks immediately — not only on
 * pages that forgot to pass the prop.
 */
type _PageSizeOptional = undefined extends ListPaginationProps["limit"]
  ? undefined extends ListPaginationProps["pageSize"]
    ? true
    : never
  : never;
const _pageSizeMustStayOptional: _PageSizeOptional = true;
void _pageSizeMustStayOptional;
