import { getTableColumns, getTableName } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { getViewConfig, isPgView, type PgColumn, type PgTable, type PgView } from "drizzle-orm/pg-core";

/** Postgres tables and read-only views used by TableService select/list. */
export type PgQueryable = PgTable | PgView;

export function queryableColumns(table: PgQueryable): Record<string, PgColumn> {
  if (isPgView(table)) {
    return getViewConfig(table).selectedFields as Record<string, PgColumn>;
  }
  return getTableColumns(table);
}

export function queryableName(table: PgQueryable): string {
  if (isPgView(table)) {
    return getViewConfig(table).name;
  }
  return getTableName(table);
}

/** Tables infer from Drizzle; views must pass an explicit `TRow` on `TableService`. */
export type InferQueryableSelect<T extends PgQueryable> = T extends PgTable
  ? InferSelectModel<T>
  : never;

export type InferQueryableInsert<T extends PgQueryable> = T extends PgView
  ? Record<string, never>
  : T extends PgTable
    ? Partial<InferInsertModel<T>>
    : Record<string, never>;
