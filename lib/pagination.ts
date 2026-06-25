/** Shared pagination defaults — no page loads more than this by default. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export function clampLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(limit, MAX_PAGE_SIZE);
}

export type PaginatedResult<T> = {
  items: T[];
  nextCursor: string | null;
};

export function paginateByCursor<T extends { createdAt: Date }>(
  rows: T[],
  limit: number
): PaginatedResult<T> {
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: slice,
    nextCursor: hasMore ? slice[slice.length - 1].createdAt.toISOString() : null,
  };
}
