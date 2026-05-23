import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { Type } from "arktype";
import type { MiddlewareHandler } from "hono";

import type { ResourceContext } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validate = arktypeValidator as (
  target: "query" | "json",
  schema: unknown,
) => MiddlewareHandler;

export type ActionMethod = "get" | "post" | "put" | "patch" | "delete";

export type ActionDefinition = {
  method: ActionMethod;
  path: string;
  handler: (c: ResourceContext) => Promise<Response> | Response;
  schema?: Type;
};

export function actionProvider(
  actions: ActionDefinition[],
  middleware: MiddlewareHandler[] = [],
): Hono {
  const app = new Hono();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = app as any;

  for (const action of actions) {
    const handlers: MiddlewareHandler[] = [...middleware];
    if (action.schema) {
      handlers.push(validate("json", action.schema));
    }
    handlers.push(async (c: ResourceContext) => action.handler(c));

    switch (action.method) {
      case "get":
        routes.get(action.path, ...handlers);
        break;
      case "post":
        routes.post(action.path, ...handlers);
        break;
      case "put":
        routes.put(action.path, ...handlers);
        break;
      case "patch":
        routes.patch(action.path, ...handlers);
        break;
      case "delete":
        routes.delete(action.path, ...handlers);
        break;
      default:
        throw new Error(`Unsupported action method: ${action.method}`);
    }
  }

  return app;
}
