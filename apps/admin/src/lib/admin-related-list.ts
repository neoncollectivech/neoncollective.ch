import type { AdminListRequestParams } from "@/lib/admin-api";

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
