"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DEFAULT_PAGE_SIZE, pageRangeLabel } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/**
 * Shared admin list footer.
 *
 * `limit` / `pageSize` are ALWAYS optional and default to DEFAULT_PAGE_SIZE.
 * Do not make them required — call sites (and future pages) often omit them.
 */
export type ListPaginationProps = {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  /**
   * Page size for the "Showing X–Y" label.
   * Optional — defaults to DEFAULT_PAGE_SIZE when omitted.
   */
  pageSize?: number | undefined;
  /**
   * Alias of `pageSize` (legacy call sites).
   * Optional — defaults to DEFAULT_PAGE_SIZE when omitted.
   */
  limit?: number | undefined;
  totalPages?: number | undefined;
  className?: string | undefined;
  /** Compact footer for dense tables */
  dense?: boolean | undefined;
};

/** @deprecated Prefer ListPaginationProps — kept so older imports/types stay optional. */
export type Props = ListPaginationProps;

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
 * Compile-time lock: `limit` and `pageSize` must remain optional.
 * If either is made required, this file fails typecheck during `next build`.
 */
type AssertOptional<T, K extends keyof T> = undefined extends T[K]
  ? true
  : never;

const _limitOptional: AssertOptional<ListPaginationProps, "limit"> = true;
const _pageSizeOptional: AssertOptional<ListPaginationProps, "pageSize"> = true;
const _propsAliasOptional: AssertOptional<Props, "limit"> = true;

/** Usage without `limit` must remain assignable (mirrors partner-incentives / list pages). */
const _usageWithoutLimit: ListPaginationProps = {
  page: 1,
  total: 0,
  onPageChange: () => {},
};
const _usageWithoutLimitViaPropsAlias: Props = {
  page: 1,
  total: 0,
  onPageChange: () => {},
};

void _limitOptional;
void _pageSizeOptional;
void _propsAliasOptional;
void _usageWithoutLimit;
void _usageWithoutLimitViaPropsAlias;
