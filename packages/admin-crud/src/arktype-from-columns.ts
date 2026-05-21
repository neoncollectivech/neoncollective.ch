import { type, type Type } from "arktype";

import { inferColumnKind } from "./filter-helpers";
import type { FilterableColumn } from "./filter-types";
import type { AdminTableMeta } from "./introspect";
import { adminListQuerySchema } from "./schemas";

export type SchemaFieldOverrides = Record<string, string>;

export type BuildArkTypeSchemasOptions = {
  create?: SchemaFieldOverrides;
  update?: SchemaFieldOverrides;
  listQuery?: SchemaFieldOverrides;
  /** jsonb columns that accept string[] in API payloads */
  jsonbStringArrays?: string[];
};

type ColumnLike = {
  columnType: string;
  dataType: string;
  notNull: boolean;
  enumValues?: readonly string[];
};

function enumArkType(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(" | ");
}

function columnCreateType(col: ColumnLike, jsonbStringArrays: string[], key: string): string {
  const override = jsonbStringArrays.includes(key);
  if (col.columnType === "PgEnumColumn" && col.enumValues?.length) {
    const base = enumArkType(col.enumValues);
    return col.notNull ? base : `${base} | null`;
  }
  if (col.columnType === "PgUUID") {
    return col.notNull ? "string.uuid" : "string.uuid | null";
  }
  if (col.columnType === "PgInteger" || col.columnType === "PgSmallInt" || col.columnType === "PgBigInt53" || col.columnType === "PgBigInt64") {
    const n = col.notNull ? "number.integer" : "number.integer | null";
    return n;
  }
  if (col.columnType === "PgBoolean") {
    return col.notNull ? "boolean" : "boolean | null";
  }
  if (col.columnType === "PgTimestamp" || col.columnType === "PgTimestampString") {
    return col.notNull ? "string" : "string | null";
  }
  if (col.columnType === "PgJsonb") {
    return override ? (col.notNull ? "string[]" : "string[] | null") : col.notNull ? "unknown" : "unknown | null";
  }
  if (col.columnType === "PgText" || col.columnType === "PgVarchar") {
    if (col.notNull) {
      return "string>0";
    }
    return "string | null";
  }
  return col.notNull ? "unknown" : "unknown | null";
}

function columnUpdateType(col: ColumnLike, jsonbStringArrays: string[], key: string): string {
  const createType = columnCreateType(col, jsonbStringArrays, key);
  return createType;
}

function buildObjectSchema(
  fields: Record<string, string>,
  optional: boolean,
): Type {
  const def: Record<string, string> = {};
  for (const [key, ark] of Object.entries(fields)) {
    def[optional ? `${key}?` : key] = ark;
  }
  return type(def);
}

export type BuiltArkTypeSchemas = {
  create?: Type;
  update?: Type;
  listQuery: Type;
};

export function buildArkTypeSchemas(
  meta: AdminTableMeta,
  opts: BuildArkTypeSchemasOptions = {},
): BuiltArkTypeSchemas {
  const jsonbArrays = opts.jsonbStringArrays ?? [];
  const createFields: Record<string, string> = {};
  for (const key of meta.writable.create) {
    if (opts.create?.[key]) {
      createFields[key] = opts.create[key];
      continue;
    }
    const col = meta.columns[key];
    if (!col) {
      continue;
    }
    createFields[key] = columnCreateType(col as ColumnLike, jsonbArrays, key);
  }
  for (const [key, ark] of Object.entries(opts.create ?? {})) {
    if (!(key in createFields)) {
      createFields[key] = ark;
    }
  }

  const updateFields: Record<string, string> = {};
  for (const key of meta.writable.update) {
    if (opts.update?.[key]) {
      updateFields[key] = opts.update[key];
      continue;
    }
    const col = meta.columns[key];
    if (!col) {
      continue;
    }
    updateFields[key] = columnUpdateType(col as ColumnLike, jsonbArrays, key);
  }
  for (const [key, ark] of Object.entries(opts.update ?? {})) {
    if (!(key in updateFields)) {
      updateFields[key] = ark;
    }
  }

  const listQueryFields: Record<string, string> = {
    "limit?": "string",
    "skip?": "string",
    "sort?": "string",
    "q?": "string",
  };
  appendFilterListQueryFields(listQueryFields, meta.filterFields, opts.listQuery);
  for (const [key, ark] of Object.entries(opts.listQuery ?? {})) {
    listQueryFields[key.includes("?") ? key : `${key}?`] = ark;
  }

  const result: BuiltArkTypeSchemas = {
    listQuery: Object.keys(listQueryFields).length > 4 ? type(listQueryFields) : adminListQuerySchema,
  };
  if (Object.keys(createFields).length > 0) {
    result.create = buildObjectSchema(createFields, false);
  }
  if (Object.keys(updateFields).length > 0) {
    result.update = buildObjectSchema(updateFields, true);
  }
  return result;
}

function isEnumColumn(col: ColumnLike): boolean {
  return col.columnType === "PgEnumColumn" && Array.isArray(col.enumValues) && col.enumValues.length > 0;
}

function appendFilterListQueryFields(
  listQueryFields: Record<string, string>,
  filterFields: Record<string, import("drizzle-orm/pg-core").PgColumn>,
  overrides?: SchemaFieldOverrides,
): void {
  for (const [key, col] of Object.entries(filterFields)) {
    if (overrides?.[key]) {
      listQueryFields[`${key}?`] = overrides[key];
      continue;
    }
    const kind = inferColumnKind(col);
    if (kind === "enum" && isEnumColumn(col as ColumnLike)) {
      const literal = enumArkType((col as ColumnLike).enumValues!);
      listQueryFields[`${key}?`] = literal;
      listQueryFields[`${key}_in?`] = `${literal}[]`;
      listQueryFields[`${key}_not?`] = literal;
      continue;
    }
    if (kind === "boolean") {
      listQueryFields[`${key}?`] = "'true' | 'false'";
      listQueryFields[`${key}_not?`] = "'true' | 'false'";
      continue;
    }
    if (kind === "timestamp" || kind === "number" || kind === "integer") {
      listQueryFields[`${key}?`] = "string";
      listQueryFields[`${key}_gt?`] = "string";
      listQueryFields[`${key}_gte?`] = "string";
      listQueryFields[`${key}_lt?`] = "string";
      listQueryFields[`${key}_lte?`] = "string";
      listQueryFields[`${key}_not?`] = "string";
      continue;
    }
    listQueryFields[`${key}?`] = "string";
    listQueryFields[`${key}_in?`] = "string";
    listQueryFields[`${key}_not?`] = "string";
    if (kind === "string" || kind === "uuid") {
      listQueryFields[`${key}_like?`] = "string";
    }
  }
}

export function buildListQuerySchemaFromFilterable(
  filterable: readonly FilterableColumn[],
  overrides?: SchemaFieldOverrides,
): Type {
  const filterFields: Record<string, import("drizzle-orm/pg-core").PgColumn> = {};
  for (const f of filterable) {
    filterFields[f.name] = f.column;
  }
  const listQueryFields: Record<string, string> = {
    "limit?": "string",
    "skip?": "string",
    "sort?": "string",
    "q?": "string",
  };
  appendFilterListQueryFields(listQueryFields, filterFields, overrides);
  for (const [key, ark] of Object.entries(overrides ?? {})) {
    listQueryFields[key.includes("?") ? key : `${key}?`] = ark;
  }
  return type(listQueryFields);
}

export function buildListQuerySchemaFromFilterMeta(
  filterMeta: import("./filter-types.js").FilterMeta,
  overrides?: SchemaFieldOverrides,
): Type {
  return buildListQuerySchemaFromFilterable(filterMeta.filterable, overrides);
}
