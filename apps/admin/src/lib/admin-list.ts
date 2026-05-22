import type { ListMeta } from "@/lib/api-client";

export const DEFAULT_ADMIN_PAGE_SIZE = 10;

export const ADMIN_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type AdminListOffsetParams = {
  limit: string;
  skip: string;
  q?: string;
  eventId?: string;
};

export function pageToLimitSkip(
  page: number,
  pageSize: number,
): AdminListOffsetParams {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);

  return {
    limit: String(safeSize),
    skip: String((safePage - 1) * safeSize),
  };
}

export function limitSkipToPage(
  meta: Pick<ListMeta, "limit" | "skip" | "total">,
) {
  const pageSize = meta.limit > 0 ? meta.limit : 1;
  const page = meta.limit > 0 ? Math.floor(meta.skip / meta.limit) + 1 : 1;
  const totalPages = meta.total > 0 ? Math.ceil(meta.total / pageSize) : 1;

  return { page, pageSize, totalPages };
}

export function listRangeLabel(
  meta: Pick<ListMeta, "limit" | "skip" | "total">,
) {
  if (meta.total === 0) {
    return "0 results";
  }

  const from = meta.skip + 1;
  const to = Math.min(meta.skip + meta.limit, meta.total);

  return `${from}–${to} of ${meta.total}`;
}

export function buildAdminListQueryKey(
  page: number,
  pageSize: number,
  extra?: Record<string, string>,
  sort?: string,
): Record<string, string> {
  const key: Record<string, string> = {
    ...pageToLimitSkip(page, pageSize),
    ...extra,
  };

  if (sort) {
    key.sort = sort;
  }

  return key;
}

export function canonicalizeIds(
  ids: Array<string | null | undefined>,
): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))].sort();
}

export function toIdInParam(ids: Array<string | null | undefined>): string {
  return canonicalizeIds(ids).join(",");
}
