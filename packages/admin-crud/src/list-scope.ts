import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { buildFilterConditions } from "./filter-helpers";
import type { FilterableColumn } from "./filter-types";
import type { AdminListMeta } from "./schemas";

const RESERVED_QUERY_KEYS = new Set(["limit", "skip", "sort", "q", "page", "pageSize"]);

export type BulkUpdateItem<TUpdate> = { id: string; data: TUpdate };

export type ListResult<TItem> = { items: TItem[]; meta: AdminListMeta };

export type ListQuery<TFilters extends Record<string, unknown> = Record<string, never>> = {
  limit: number;
  skip: number;
  sort?: string;
  q?: string;
  filters: TFilters;
};

export type ListScopeParams = {
  query: ListQuery;
  filterable?: readonly FilterableColumn[];
  searchFields?: PgColumn[];
  sortFields?: Record<string, PgColumn>;
  defaultSort?: string;
  extraWhere?: SQL;
  maxPageSize?: number;
};

export type ResolvedListScope = {
  where: SQL | undefined;
  orderBy: SQL[];
  limit: number;
  skip: number;
};

function clampLimit(raw: number, maxPageSize: number): number {
  if (!Number.isFinite(raw) || raw < 1) {
    return 100;
  }
  return Math.min(maxPageSize, Math.floor(raw));
}

export function parseListQuery<TFilters extends Record<string, unknown> = Record<string, never>>(
  raw: Record<string, string | string[] | undefined>,
  maxPageSize = 100,
): ListQuery<TFilters> {
  const filters: Record<string, string | string[] | undefined> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!RESERVED_QUERY_KEYS.has(key)) {
      filters[key] = val;
    }
  }

  let limit = clampLimit(Number.parseInt(String(raw.limit ?? "100"), 10) || 100, maxPageSize);
  let skip = Math.max(0, Number.parseInt(String(raw.skip ?? "0"), 10) || 0);

  const pageRaw = raw.page;
  const pageSizeRaw = raw.pageSize;
  if (raw.limit === undefined && raw.skip === undefined && (pageRaw !== undefined || pageSizeRaw !== undefined)) {
    const page = Math.max(1, Number.parseInt(String(pageRaw ?? "1"), 10) || 1);
    const pageSize = clampLimit(
      Number.parseInt(String(pageSizeRaw ?? "20"), 10) || 20,
      maxPageSize,
    );
    limit = pageSize;
    skip = (page - 1) * pageSize;
  }

  const sort = typeof raw.sort === "string" ? raw.sort : undefined;
  const q = typeof raw.q === "string" ? raw.q : undefined;

  return {
    limit,
    skip,
    sort,
    q,
    filters: filters as TFilters,
  };
}

function parseSort(
  sort: string | undefined,
  sortFields: Record<string, PgColumn> | undefined,
  defaultSort: string | undefined,
  idColumn: PgColumn,
): SQL[] {
  const raw = sort?.trim() || defaultSort?.trim();
  if (!raw) {
    return [desc(idColumn)];
  }
  const descFlag = raw.startsWith("-");
  const key = descFlag ? raw.slice(1) : raw;
  const column = sortFields?.[key];
  if (!column) {
    return [desc(idColumn)];
  }
  return [descFlag ? desc(column) : asc(column)];
}

export function resolveAdminListScope(
  params: ListScopeParams,
  idColumn: PgColumn,
): ResolvedListScope {
  const maxPageSize = params.maxPageSize ?? 100;
  const limit = clampLimit(params.query.limit, maxPageSize);
  const skip = Math.max(0, params.query.skip);

  const conditions: (SQL | undefined)[] = [];
  if (params.extraWhere) {
    conditions.push(params.extraWhere);
  }

  if (params.filterable?.length) {
    const filterConds = buildFilterConditions(
      params.query.filters as Record<string, string | string[] | undefined>,
      params.filterable,
    );
    conditions.push(...filterConds);
  }

  if (params.query.q?.trim() && params.searchFields?.length) {
    const term = `%${params.query.q.trim()}%`;
    const parts = params.searchFields.map((col) => ilike(col, term));
    conditions.push(or(...parts));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const orderBy = parseSort(
    params.query.sort,
    params.sortFields,
    params.defaultSort,
    idColumn,
  );

  return { where: whereClause, orderBy, limit, skip };
}

export function listMetaFromScope(
  scope: ResolvedListScope,
  total: number,
): AdminListMeta {
  const { limit, skip } = scope;
  return {
    total,
    limit,
    skip,
    page: limit > 0 ? Math.floor(skip / limit) + 1 : 1,
    pageSize: limit,
  };
}

export async function runAdminListFromScope<TTable extends PgTable>(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  table: TTable;
  scope: ResolvedListScope;
  listProject?: string[];
}): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const { db, table, scope } = params;
  const rows = (await db
    .select()
    .from(table)
    .where(scope.where)
    .orderBy(...scope.orderBy)
    .limit(scope.limit)
    .offset(scope.skip)) as Record<string, unknown>[];

  const [countRow] = (await db
    .select({ total: count() })
    .from(table)
    .where(scope.where)) as { total: number }[];

  return { rows, total: Number(countRow?.total ?? 0) };
}

export function parentWhere(parentId: string, column: PgColumn): SQL {
  return eq(column, parentId);
}
