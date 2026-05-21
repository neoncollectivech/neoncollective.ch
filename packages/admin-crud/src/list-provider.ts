import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import type { AdminListMeta } from "./schemas";
import type { AdminCrudContext } from "./types";

export type ListProviderResult = {
  items: unknown[];
  meta: AdminListMeta;
};

export type ListProviderHandler = (
  c: AdminCrudContext,
) => Promise<ListProviderResult>;

export function listProvider(
  handler: ListProviderHandler,
  middleware: MiddlewareHandler[] = [],
): Hono {
  const app = new Hono();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = app as any;
  routes.get("/", ...middleware, async (c: AdminCrudContext) => {
    const { items, meta } = await handler(c);
    return c.json({ items, meta });
  });
  return app;
}
