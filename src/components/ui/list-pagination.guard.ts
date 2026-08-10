/**
 * Permanent regression guard for ListPagination.
 *
 * `next build` typechecks this file. If `limit` (or `pageSize`) is ever made
 * required again on ListPaginationProps / Props, this module fails to compile
 * — instead of failing later on a random page like partner-incentives.
 */
import type {
  ListPaginationProps,
  Props,
} from "@/components/ui/list-pagination";

type IsOptional<T, K extends keyof T> = undefined extends T[K] ? true : false;

type _LimitOptional = IsOptional<ListPaginationProps, "limit"> extends true
  ? true
  : never;
type _PageSizeOptional = IsOptional<ListPaginationProps, "pageSize"> extends true
  ? true
  : never;
type _PropsAliasLimitOptional = IsOptional<Props, "limit"> extends true
  ? true
  : never;

const limitOptional: _LimitOptional = true;
const pageSizeOptional: _PageSizeOptional = true;
const propsAliasLimitOptional: _PropsAliasLimitOptional = true;

/** Call-site shape used by many admin pages (no limit prop). */
export const listPaginationPropsWithoutLimit: ListPaginationProps = {
  page: 1,
  total: 25,
  totalPages: 1,
  onPageChange: (_page: number) => {},
};

export const listPaginationPropsAliasWithoutLimit: Props = {
  page: 1,
  total: 25,
  onPageChange: (_page: number) => {},
};

void limitOptional;
void pageSizeOptional;
void propsAliasLimitOptional;
