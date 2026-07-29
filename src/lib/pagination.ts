export type PaginatedResult<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  count: number;
};

export const DEFAULT_PAGE_SIZE = 25;

export function parsePaginatedResponse<T>(payload: {
  data?: T[];
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  count?: number;
}): PaginatedResult<T> {
  const data = payload.data ?? [];
  const page = Number(payload.page) || 1;
  const limit = Number(payload.limit) || DEFAULT_PAGE_SIZE;
  const total =
    typeof payload.total === "number"
      ? payload.total
      : typeof payload.count === "number"
        ? payload.count
        : data.length;
  const totalPages =
    typeof payload.totalPages === "number"
      ? payload.totalPages
      : Math.max(1, Math.ceil(total / limit) || 1);
  return {
    data,
    page,
    limit,
    total,
    totalPages,
    count: typeof payload.count === "number" ? payload.count : data.length,
  };
}

export function pageRangeLabel(page: number, limit: number, total: number) {
  if (total <= 0) return "0 of 0";
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return `${from}–${to} of ${total}`;
}
