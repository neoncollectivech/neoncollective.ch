import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { parseAdminListQuery, type AdminListMeta, type AdminListQuery } from "./schemas.js";

export type ListHandlerParams<TTable extends PgTable> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  table: TTable;
  query: AdminListQuery & Record<string, string | undefined>;
  idColumn: PgColumn;
  searchFields?: PgColumn[];
  filterFields?: Record<string, PgColumn>;
  sortFields?: Record<string, PgColumn>;
  defaultSort?: string;
  extraWhere?: SQL;
  maxPageSize?: number;
};

function parseSort(
  sort: string | undefined,
  sortFields: Record<string, PgColumn> | undefined,
  defaultSort: string | undefined,
): { column: PgColumn; desc: boolean } | null {
  const raw = sort?.trim() || defaultSort?.trim();
  if (!raw || !sortFields) {
    return null;
  }
  const desc = raw.startsWith("-");
  const key = desc ? raw.slice(1) : raw;
  const column = sortFields[key];
  if (!column) {
    return null;
  }
  return { column, desc };
}

export async function runAdminList<TTable extends PgTable>(
  params: ListHandlerParams<TTable>,
): Promise<{ rows: Record<string, unknown>[]; meta: AdminListMeta }> {
  const parsed = parseAdminListQuery(params.query);
  const page = parsed.page;
  const maxPageSize = params.maxPageSize ?? 100;
  const pageSize = Math.min(maxPageSize, parsed.pageSize);
  const offset = (page - 1) * pageSize;

  const conditions: (SQL | undefined)[] = [];
  if (params.extraWhere) {
    conditions.push(params.extraWhere);
  }

  if (parsed.q?.trim() && params.searchFields?.length) {
    const term = `%${parsed.q.trim()}%`;
    const parts = params.searchFields.map((col) => ilike(col, term));
    conditions.push(or(...parts));
  }

  if (params.filterFields) {
    for (const [key, column] of Object.entries(params.filterFields)) {
      const val = params.query[key];
      if (val !== undefined && val !== "") {
        conditions.push(eq(column, val));
      }
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const sortParsed = parseSort(parsed.sort, params.sortFields, params.defaultSort);
  const orderBy = sortParsed
    ? sortParsed.desc
      ? desc(sortParsed.column)
      : asc(sortParsed.column)
    : desc(params.idColumn);

  const rows = (await params.db
    .select()
    .from(params.table)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset)) as Record<string, unknown>[];

  const [countRow] = (await params.db
    .select({ total: count() })
    .from(params.table)
    .where(whereClause)) as { total: number }[];

  return {
    rows,
    meta: {
      page,
      pageSize,
      total: Number(countRow?.total ?? 0),
    },
  };
}
