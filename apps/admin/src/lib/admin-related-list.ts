import type { AdminListRequestParams } from "@/lib/admin-api";
import type { ListResponse } from "@/lib/api-client";

/** Default limit for related-resource list fetches on detail views. */
export const ADMIN_RELATED_LIST_LIMIT = "100";

export function relatedListParams(
  filters: Partial<AdminListRequestParams>,
): AdminListRequestParams {
  return {
    limit: ADMIN_RELATED_LIST_LIMIT,
    skip: "0",
    ...filters,
  };
}

/** First row from a related list query (detail views with 0–1 related rows). */
export async function relatedListFirst<TRow>(
  listFn: (params: AdminListRequestParams) => Promise<ListResponse<TRow>>,
  params: AdminListRequestParams,
): Promise<TRow | null> {
  const res = await listFn(params);

  return res.items[0] ?? null;
}

/** Total from a related list meta (counts without loading all rows). */
export async function relatedListTotal(
  listFn: (params: AdminListRequestParams) => Promise<ListResponse<unknown>>,
  params: AdminListRequestParams,
): Promise<number> {
  const res = await listFn(params);

  return res.meta.total;
}
