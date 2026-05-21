import type { AdminCrudContext } from "@neon/admin-crud";
import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export type ServiceParent = {
  param: string;
  column: PgColumn;
  value: string;
};

export type ServiceContext = {
  parent?: ServiceParent;
  hono?: AdminCrudContext;
};

export type ListWhereHook = (ctx?: ServiceContext) => SQL | undefined | Promise<SQL | undefined>;
