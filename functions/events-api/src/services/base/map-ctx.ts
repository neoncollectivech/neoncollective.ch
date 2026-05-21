import type { AdminCrudContext } from "@neon/admin-crud";
import { eq } from "drizzle-orm";

import type { ServiceContext } from "./types";

export function mapCtx(
  c: AdminCrudContext,
  parent?: { param: string; column: import("drizzle-orm/pg-core").PgColumn },
): ServiceContext {
  const ctx: ServiceContext = { hono: c };
  if (parent) {
    const value = c.req.param(parent.param);
    if (value) {
      ctx.parent = { param: parent.param, column: parent.column, value };
    }
  }
  return ctx;
}

export function parentSqlFromCtx(ctx?: ServiceContext): import("drizzle-orm").SQL | undefined {
  if (!ctx?.parent) {
    return undefined;
  }
  return eq(ctx.parent.column, ctx.parent.value);
}
