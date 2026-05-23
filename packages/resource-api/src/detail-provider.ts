import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import type { ResourceContext } from "./types";

export type DetailProviderHandler = (
  id: string,
  c: ResourceContext,
) => Promise<unknown | null | undefined>;

export function detailProvider(
  handler: DetailProviderHandler,
  middleware: MiddlewareHandler[] = [],
): Hono {
  const app = new Hono();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = app as any;
  routes.get("/:id", ...middleware, async (c: ResourceContext) => {
    const id = c.req.param("id");
    const item = await handler(id, c);
    if (item === null || item === undefined) {
      return c.json({ error: "Not found." }, 404);
    }
    return c.json({ item });
  });
  return app;
}
