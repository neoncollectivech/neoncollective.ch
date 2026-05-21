import { listMetaFromScope, type ListQuery } from "@neon/admin-crud";
import type { SQL } from "drizzle-orm";

/** Build list meta for custom joined queries that share filter/pagination with count. */
export function customListMeta(
  query: ListQuery<Record<string, unknown>>,
  whereClause: SQL | undefined,
  total: number,
) {
  return listMetaFromScope(
    { where: whereClause, orderBy: [], limit: query.limit, skip: query.skip },
    total,
  );
}
