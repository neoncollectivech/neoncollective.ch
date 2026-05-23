import {
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  ne,
  type SQL,
} from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import type {
  ColumnKind,
  FilterableColumn,
  FilterMeta,
  FilterOperator,
  FilterParams,
  ParsedFilterKey,
} from "./filter-types";

type ColumnLike = {
  columnType: string;
  enumValues?: readonly string[];
};

export function inferColumnKind(column: PgColumn): ColumnKind {
  const col = column as ColumnLike;
  if (col.columnType === "PgEnumColumn" && col.enumValues?.length) {
    return "enum";
  }
  if (col.columnType === "PgBoolean") {
    return "boolean";
  }
  if (col.columnType === "PgUUID") {
    return "uuid";
  }
  if (
    col.columnType === "PgInteger" ||
    col.columnType === "PgSmallInt" ||
    col.columnType === "PgBigInt53" ||
    col.columnType === "PgBigInt64"
  ) {
    return "integer";
  }
  if (col.columnType === "PgNumeric" || col.columnType === "PgReal" || col.columnType === "PgDoublePrecision") {
    return "number";
  }
  if (col.columnType === "PgTimestamp" || col.columnType === "PgTimestampString") {
    return "timestamp";
  }
  return "string";
}

export function filterable<Name extends string>(
  name: Name,
  column: PgColumn,
): FilterableColumn<Name, PgColumn, ColumnKind> {
  return {
    name,
    column,
    kind: inferColumnKind(column),
  };
}

export function defineFilterable<const T extends readonly FilterableColumn[]>(
  filterable: T,
): T {
  return filterable;
}

export function filterableFromFields(
  fields: Record<string, PgColumn>,
): readonly FilterableColumn[] {
  return Object.entries(fields).map(([name, column]) => filterable(name, column));
}

export function filterMetaFromFilterable(
  filterable: readonly FilterableColumn[],
): FilterMeta {
  const legalKeys = new Set<string>();
  for (const field of filterable) {
    legalKeys.add(field.name);
    legalKeys.add(`${field.name}_in`);
    legalKeys.add(`${field.name}_not`);
    if (
      field.kind === "timestamp" ||
      field.kind === "number" ||
      field.kind === "integer"
    ) {
      legalKeys.add(`${field.name}_gt`);
      legalKeys.add(`${field.name}_gte`);
      legalKeys.add(`${field.name}_lt`);
      legalKeys.add(`${field.name}_lte`);
    }
    if (field.kind === "string" || field.kind === "uuid") {
      legalKeys.add(`${field.name}_like`);
    }
  }
  return { filterable, legalKeys };
}

const SUFFIX_OPERATORS: { suffix: string; operator: FilterOperator }[] = [
  { suffix: "_in", operator: "in" },
  { suffix: "_not", operator: "not" },
  { suffix: "_gte", operator: "gte" },
  { suffix: "_lte", operator: "lte" },
  { suffix: "_gt", operator: "gt" },
  { suffix: "_lt", operator: "lt" },
  { suffix: "_like", operator: "like" },
];

export function parseFilterKey(key: string, filterable: readonly FilterableColumn[]): ParsedFilterKey | null {
  for (const field of filterable) {
    if (key === field.name) {
      return { name: field.name, operator: "eq" };
    }
    for (const { suffix, operator } of SUFFIX_OPERATORS) {
      if (key === `${field.name}${suffix}`) {
        return { name: field.name, operator };
      }
    }
  }
  return null;
}

function operatorAllowed(kind: ColumnKind, operator: FilterOperator): boolean {
  if (operator === "eq" || operator === "not") {
    return true;
  }
  if (operator === "in") {
    return kind === "enum" || kind === "string" || kind === "uuid";
  }
  if (operator === "like") {
    return kind === "string" || kind === "uuid";
  }
  if (operator === "gt" || operator === "gte" || operator === "lt" || operator === "lte") {
    return kind === "timestamp" || kind === "number" || kind === "integer";
  }
  return false;
}

function normalizeFilterValue(
  raw: string | string[] | undefined,
  operator: FilterOperator,
): string | string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (Array.isArray(raw)) {
    const cleaned = raw.map((v) => v.trim()).filter((v) => v.length > 0);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (operator === "in") {
    return trimmed.split(",").map((v) => v.trim()).filter((v) => v.length > 0);
  }
  return trimmed;
}

function coerceComparable(value: string, kind: ColumnKind): string | number | boolean | Date {
  if (kind === "integer" || kind === "number") {
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  }
  if (kind === "boolean") {
    return value === "true" || value === "1";
  }
  if (kind === "timestamp") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d;
  }
  return value;
}

function conditionForFilter(
  field: FilterableColumn,
  operator: FilterOperator,
  raw: string | string[] | undefined,
): SQL | undefined {
  if (!operatorAllowed(field.kind, operator)) {
    return undefined;
  }
  const value = normalizeFilterValue(raw, operator);
  if (value === undefined) {
    return undefined;
  }
  const col = field.column;

  if (operator === "in") {
    const vals = Array.isArray(value) ? value : [value];
    if (vals.length === 0) {
      return undefined;
    }
    return inArray(col, vals.map((v) => coerceComparable(v, field.kind)));
  }
  if (operator === "like") {
    const term = Array.isArray(value) ? value[0] : value;
    if (!term) {
      return undefined;
    }
    return ilike(col, term.includes("%") ? term : `%${term}%`);
  }

  const scalar = Array.isArray(value) ? value[0] : value;
  if (!scalar) {
    return undefined;
  }
  const coerced = coerceComparable(scalar, field.kind);

  switch (operator) {
    case "eq":
      return eq(col, coerced);
    case "not":
      return ne(col, coerced);
    case "gt":
      return gt(col, coerced);
    case "gte":
      return gte(col, coerced);
    case "lt":
      return lt(col, coerced);
    case "lte":
      return lte(col, coerced);
    default:
      return undefined;
  }
}

export function buildFilterConditions(
  filters: FilterParams,
  filterable: readonly FilterableColumn[],
): SQL[] {
  if (!filters || Object.keys(filters).length === 0) {
    return [];
  }
  const byName = new Map(filterable.map((f) => [f.name, f]));
  const conditions: SQL[] = [];

  for (const [key, raw] of Object.entries(filters)) {
    const parsed = parseFilterKey(key, filterable);
    if (!parsed) {
      continue;
    }
    const field = byName.get(parsed.name);
    if (!field) {
      continue;
    }
    const cond = conditionForFilter(field, parsed.operator, raw);
    if (cond) {
      conditions.push(cond);
    }
  }
  return conditions;
}
