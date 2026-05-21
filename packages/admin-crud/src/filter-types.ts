import type { PgColumn } from "drizzle-orm/pg-core";

export type ColumnKind =
  | "string"
  | "enum"
  | "boolean"
  | "number"
  | "integer"
  | "timestamp"
  | "uuid";

export type FilterableColumn<
  Name extends string = string,
  Col extends PgColumn = PgColumn,
  Kind extends ColumnKind = ColumnKind,
> = {
  readonly name: Name;
  readonly column: Col;
  readonly kind: Kind;
};

export type FilterOperator =
  | "eq"
  | "in"
  | "not"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like";

export type ParsedFilterKey = {
  name: string;
  operator: FilterOperator;
};

/** Flat filter params keyed by HTTP query param (e.g. status_in). */
export type FilterParams = Record<string, string | string[] | undefined>;

export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export type FilterParamsForColumn<
  Name extends string,
  Value,
  Kind extends ColumnKind,
> = (Kind extends "enum"
  ? {
      [K in Name]?: Value;
    } & {
      [K in `${Name}_in`]?: readonly Value[] | Value[];
    } & {
      [K in `${Name}_not`]?: Value;
    }
  : Record<never, never>) &
  (Kind extends "timestamp" | "number" | "integer"
    ? {
        [K in Name]?: Value;
      } & {
        [K in `${Name}_gt`]?: Value;
      } & {
        [K in `${Name}_gte`]?: Value;
      } & {
        [K in `${Name}_lt`]?: Value;
      } & {
        [K in `${Name}_lte`]?: Value;
      } & {
        [K in `${Name}_not`]?: Value;
      }
    : Record<never, never>) &
  (Kind extends "string" | "uuid" | "boolean"
    ? {
        [K in Name]?: Value;
      } & {
        [K in `${Name}_in`]?: readonly Value[] | Value[];
      } & {
        [K in `${Name}_not`]?: Value;
      } & {
        [K in `${Name}_like`]?: string;
      }
    : Record<never, never>);

export type InferFilterParams<
  T extends readonly FilterableColumn<string, PgColumn, ColumnKind>[],
> = UnionToIntersection<
  {
    [I in keyof T]: T[I] extends FilterableColumn<infer N, PgColumn, infer K>
      ? FilterParamsForColumn<N, string, K>
      : never;
  }[number]
>;

export type FilterMeta = {
  filterable: readonly FilterableColumn[];
  legalKeys: Set<string>;
};
