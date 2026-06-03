import type { PgColumn } from "drizzle-orm/pg-core";

import { queryableColumns, queryableName, type PgQueryable } from "./pg-queryable";

import { filterable } from "./filter-helpers";
import type { FilterableColumn } from "./filter-types";

export type IntrospectExclude = {
  create?: string[];
  update?: string[];
  list?: string[];
  read?: string[];
  /** Column names excluded from default filter query params. */
  filter?: string[];
  /** Column names excluded from default sort query params. */
  sort?: string[];
};

export type IntrospectListOverrides = {
  searchFields?: PgColumn[];
  /** Extra filter columns merged onto introspected defaults (opt-out via exclude.filter). */
  filterFields?: Record<string, PgColumn>;
  /** Extra sort columns merged onto introspected defaults (opt-out via exclude.sort). */
  sortFields?: Record<string, PgColumn>;
  defaultSort?: string;
};

export type IntrospectOptions = {
  exclude?: IntrospectExclude;
  list?: IntrospectListOverrides;
  idColumn?: PgColumn;
  /** When set, only these fields are used instead of introspected lists. */
  fields?: {
    create?: string[];
    update?: string[];
    list?: string[];
    read?: string[] | "*";
  };
};

export type ResourceMeta = {
  tableName: string;
  columns: Record<string, PgColumn>;
  idColumn: PgColumn;
  writable: { create: string[]; update: string[] };
  project: { list: string[]; read: string[] | "*" };
  searchFields: PgColumn[];
  filterFields: Record<string, PgColumn>;
  sortFields: Record<string, PgColumn>;
  filterable: readonly FilterableColumn[];
  defaultSort: string;
};

const SYSTEM_CREATE_EXCLUDE = new Set(["id", "createdAt", "updatedAt"]);
const SYSTEM_UPDATE_EXCLUDE = new Set(["id", "createdAt"]);
const DEFAULT_LIST_EXCLUDE = new Set<string>();

function isTextColumn(col: PgColumn): boolean {
  return col.columnType === "PgText" || col.columnType === "PgVarchar";
}

function listFieldsFromColumns(
  columns: Record<string, PgColumn>,
  excludeKeys: string[] | undefined,
  overrides?: Record<string, PgColumn>,
): Record<string, PgColumn> {
  const excluded = new Set(excludeKeys ?? []);
  const fields: Record<string, PgColumn> = {};
  for (const [key, col] of Object.entries(columns)) {
    if (!excluded.has(key)) {
      fields[key] = col;
    }
  }
  if (overrides) {
    Object.assign(fields, overrides);
  }
  return fields;
}

function resolveIdColumn(
  columns: Record<string, PgColumn>,
  idColumnOverride?: PgColumn,
): PgColumn {
  if (idColumnOverride) {
    return idColumnOverride;
  }
  for (const col of Object.values(columns)) {
    if (col.primary) {
      return col;
    }
  }
  const fallback = columns.id;
  if (!fallback) {
    throw new Error("introspectTable: table has no primary key column");
  }
  return fallback;
}

export function introspectTable<T extends PgQueryable>(
  table: T,
  opts: IntrospectOptions = {},
): ResourceMeta {
  const columns = queryableColumns(table);
  const tableName = queryableName(table);
  const idColumn = resolveIdColumn(columns, opts.idColumn);
  const exclude = opts.exclude ?? {};
  const allKeys = Object.keys(columns);

  const writableCreate =
    opts.fields?.create ??
    allKeys.filter(
      (k) => !SYSTEM_CREATE_EXCLUDE.has(k) && !(exclude.create ?? []).includes(k),
    );

  const writableUpdate =
    opts.fields?.update ??
    allKeys.filter(
      (k) => !SYSTEM_UPDATE_EXCLUDE.has(k) && !(exclude.update ?? []).includes(k),
    );

  const projectList =
    opts.fields?.list ??
    allKeys.filter((k) => !(exclude.list ?? [...DEFAULT_LIST_EXCLUDE]).includes(k));

  const projectRead = opts.fields?.read ?? "*";

  const searchFields =
    opts.list?.searchFields ??
    Object.entries(columns)
      .filter(([k, col]) => isTextColumn(col) && !(exclude.list ?? []).includes(k))
      .map(([, col]) => col)
      .slice(0, 6);

  const filterFields = listFieldsFromColumns(
    columns,
    exclude.filter,
    opts.list?.filterFields,
  );

  const sortFields = listFieldsFromColumns(
    columns,
    exclude.sort,
    opts.list?.sortFields,
  );

  const filterableColumns = Object.entries(filterFields).map(([name, column]) =>
    filterable(name, column),
  );

  let defaultSort = opts.list?.defaultSort;
  if (!defaultSort) {
    if (columns.createdAt) {
      defaultSort = "-createdAt";
    } else {
      defaultSort = "-id";
    }
  }

  return {
    tableName,
    columns,
    idColumn,
    writable: { create: writableCreate, update: writableUpdate },
    project: { list: projectList, read: projectRead },
    searchFields,
    filterFields,
    sortFields,
    filterable: filterableColumns,
    defaultSort,
  };
}
