import { getTableColumns, getTableName } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

export type IntrospectExclude = {
  create?: string[];
  update?: string[];
  list?: string[];
  read?: string[];
};

export type IntrospectListOverrides = {
  searchFields?: PgColumn[];
  filterFields?: Record<string, PgColumn>;
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

export type AdminTableMeta = {
  tableName: string;
  columns: Record<string, PgColumn>;
  idColumn: PgColumn;
  writable: { create: string[]; update: string[] };
  project: { list: string[]; read: string[] | "*" };
  searchFields: PgColumn[];
  filterFields: Record<string, PgColumn>;
  sortFields: Record<string, PgColumn>;
  defaultSort: string;
};

const SYSTEM_CREATE_EXCLUDE = new Set(["id", "createdAt", "updatedAt"]);
const SYSTEM_UPDATE_EXCLUDE = new Set(["id", "createdAt"]);
const DEFAULT_LIST_EXCLUDE = new Set<string>();

function isTextColumn(col: PgColumn): boolean {
  return col.columnType === "PgText" || col.columnType === "PgVarchar";
}

function isEnumColumn(col: PgColumn): col is PgColumn & { enumValues: readonly string[] } {
  return col.columnType === "PgEnumColumn" && Array.isArray((col as { enumValues?: unknown }).enumValues);
}

function isTimestampColumn(col: PgColumn): boolean {
  return col.columnType === "PgTimestamp" || col.columnType === "PgTimestampString";
}

function isSortableColumn(key: string, col: PgColumn): boolean {
  if (isTimestampColumn(col)) {
    return true;
  }
  if (isTextColumn(col) && /title|name|slug|email/i.test(key)) {
    return true;
  }
  return false;
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
    throw new Error("introspectPgTable: table has no primary key column");
  }
  return fallback;
}

export function introspectPgTable<T extends PgTable>(
  table: T,
  opts: IntrospectOptions = {},
): AdminTableMeta {
  const columns = getTableColumns(table);
  const tableName = getTableName(table);
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

  const filterFields: Record<string, PgColumn> = { ...opts.list?.filterFields };
  if (!opts.list?.filterFields) {
    for (const [key, col] of Object.entries(columns)) {
      if (isEnumColumn(col) || col.columnType === "PgBoolean") {
        filterFields[key] = col;
      }
    }
  }

  const sortFields: Record<string, PgColumn> = { ...opts.list?.sortFields };
  if (!opts.list?.sortFields) {
    for (const [key, col] of Object.entries(columns)) {
      if (isSortableColumn(key, col)) {
        sortFields[key] = col;
      }
    }
  }

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
    defaultSort,
  };
}
