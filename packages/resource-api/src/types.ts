import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { Context, Hono } from "hono";

import type { BuildArkTypeSchemasOptions } from "./arktype-from-columns";
import type { IntrospectExclude, IntrospectListOverrides } from "./introspect";

export type ResourceOperation = "list" | "read" | "create" | "update" | "delete";

export type ResourceContext = Context;

export type ResourceHooks = {
  beforeCreate?: (
    data: Record<string, unknown>,
    ctx: ResourceContext,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  beforeUpdate?: (
    id: string,
    data: Record<string, unknown>,
    ctx: ResourceContext,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  beforeDelete?: (id: string, ctx: ResourceContext) => Promise<void> | void;
  listWhere?: (ctx: ResourceContext) => SQL | undefined | Promise<SQL | undefined>;
};

export type ResourceProviderOptions = {
  exclude?: IntrospectExclude;
  list?: IntrospectListOverrides;
  idColumn?: PgColumn;
  fields?: {
    create?: string[];
    update?: string[];
    list?: string[];
    read?: string[] | "*";
  };
  parent?: {
    param: string;
    column: PgColumn;
  };
  operations?: ResourceOperation[];
  schemas?: BuildArkTypeSchemasOptions;
  hooks?: ResourceHooks;
};

export type { Hono };
