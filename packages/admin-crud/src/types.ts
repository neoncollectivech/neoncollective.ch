import type { Type } from "arktype";
import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context, Hono, MiddlewareHandler } from "hono";

export type CrudOperation = "list" | "read" | "create" | "update" | "delete";

export type AdminCrudContext = Context;

export type AdminCrudHooks = {
  beforeCreate?: (
    data: Record<string, unknown>,
    ctx: AdminCrudContext,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  beforeUpdate?: (
    id: string,
    data: Record<string, unknown>,
    ctx: AdminCrudContext,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  beforeDelete?: (id: string, ctx: AdminCrudContext) => Promise<void> | void;
  listWhere?: (ctx: AdminCrudContext) => SQL | undefined | Promise<SQL | undefined>;
};

export type AdminCrudConfig = {
  resource: string;
  table: PgTable;
  idColumn?: PgColumn;
  basePath?: string;
  parent?: {
    param: string;
    column: PgColumn;
  };
  operations?: CrudOperation[];
  middleware?: MiddlewareHandler[];
  schemas?: {
    create?: Type;
    update?: Type;
    listQuery?: Type;
  };
  fields: {
    create?: string[];
    update?: string[];
    list?: string[];
    read?: string[] | "*";
  };
  searchFields?: PgColumn[];
  filterFields?: Record<string, PgColumn>;
  sortFields?: Record<string, PgColumn>;
  defaultSort?: string;
  serialize?: (
    row: Record<string, unknown>,
    ctx: AdminCrudContext,
  ) => unknown | Promise<unknown>;
  hooks?: AdminCrudHooks;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDb: () => any;
};

export type RegisterAdminRouteConfig = {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  middleware?: MiddlewareHandler[];
  handler: (c: AdminCrudContext) => Promise<Response> | Response;
};

export type { Hono };
