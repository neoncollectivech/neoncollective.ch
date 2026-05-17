import type { Hono } from "hono";

import type { AdminCrudContext, RegisterAdminRouteConfig } from "./types.js";

export function registerAdminRoute(app: Hono, config: RegisterAdminRouteConfig): void {
  const middleware = config.middleware ?? [];
  const handler = (c: AdminCrudContext) => config.handler(c);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = app as any;

  switch (config.method) {
    case "get":
      routes.get(config.path, ...middleware, handler);
      break;
    case "post":
      routes.post(config.path, ...middleware, handler);
      break;
    case "put":
      routes.put(config.path, ...middleware, handler);
      break;
    case "patch":
      routes.patch(config.path, ...middleware, handler);
      break;
    case "delete":
      routes.delete(config.path, ...middleware, handler);
      break;
    default:
      throw new Error(`Unsupported method: ${config.method}`);
  }
}
