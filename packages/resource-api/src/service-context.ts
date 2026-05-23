import { eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export type ServiceParent = {
  param: string;
  column: PgColumn;
  value: string;
};

/** Optional context passed from HTTP routes into TableService methods. */
export type ServiceContext = {
  parent?: ServiceParent;
  /** Domain apps may attach AdminSession or other request data here. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request?: Record<string, any>;
};

export function parentSqlFromCtx(ctx?: ServiceContext): SQL | undefined {
  if (!ctx?.parent) {
    return undefined;
  }
  return eq(ctx.parent.column, ctx.parent.value);
}
