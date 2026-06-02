import type { ResourceContext } from "@neon/resource-api";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import type { AppEnv } from "../../auth/env";
import type { AdminSession } from "../../auth/resolvers/admin-session";
import type { ServiceContext } from "./types";

export function mapCtx(
  c: Context<AppEnv> | ResourceContext,
  parent?: { param: string; column: PgColumn },
): ServiceContext {
  const ctx: ServiceContext = { hono: c };
  if (parent) {
    const value = c.req.param(parent.param);
    if (value) {
      ctx.parent = { param: parent.param, column: parent.column, value };
    }
  }
  const adminSession =
    "var" in c ? (c as Context<AppEnv>).var.adminSession : undefined;
  if (adminSession) {
    ctx.adminSession = adminSession as AdminSession;
  }
  return ctx;
}
