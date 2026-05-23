import type { ResourceContext } from "@neon/resource-api";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import type { AdminEnv, AdminSession } from "../../auth/require-admin-session";
import type { ServiceContext } from "./types";

export function mapCtx(
  c: Context<AdminEnv> | ResourceContext,
  parent?: { param: string; column: PgColumn },
): ServiceContext {
  const ctx: ServiceContext = { hono: c };
  if (parent) {
    const value = c.req.param(parent.param);
    if (value) {
      ctx.parent = { param: parent.param, column: parent.column, value };
    }
  }
  const adminSession = "get" in c ? (c as Context<AdminEnv>).get("adminSession") : undefined;
  if (adminSession) {
    ctx.adminSession = adminSession as AdminSession;
  }
  return ctx;
}
