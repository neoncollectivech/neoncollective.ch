import { arktypeValidator } from "@hono/arktype-validator";
import { type, type Type } from "arktype";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import type { AdminCrudContext } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validate = arktypeValidator as (
  target: "json",
  schema: unknown,
) => MiddlewareHandler;

export type BulkServiceBridge = {
  createBulk?: (
    items: Record<string, unknown>[],
    ctx: AdminCrudContext,
  ) => Promise<Record<string, unknown>[]>;
  updateBulk?: (
    updates: { id: string; data: Record<string, unknown> }[],
    ctx: AdminCrudContext,
  ) => Promise<Record<string, unknown>[]>;
};

export type BulkProviderOptions = {
  create?: boolean;
  update?: boolean;
  createSchema?: Type;
  updateSchema?: Type;
  middleware?: MiddlewareHandler[];
  service: BulkServiceBridge;
};

export function buildBulkCreateSchema(itemSchema: Type): Type {
  return type({ items: itemSchema.array() });
}

export function buildBulkUpdateSchema(): Type {
  return type({
    items: type({
      id: "string",
    }).array(),
  });
}

export function bulkProvider(opts: BulkProviderOptions): Hono {
  const app = new Hono();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = app as any;
  const middleware = opts.middleware ?? [];

  if (opts.create && opts.createSchema && opts.service.createBulk) {
    const schema = buildBulkCreateSchema(opts.createSchema);
    routes.post(
      "/bulk",
      ...middleware,
      validate("json", schema),
      async (c: AdminCrudContext) => {
        const body = schema.assert(await c.req.json()) as { items: Record<string, unknown>[] };
        const items = await opts.service.createBulk!(body.items, c);
        return c.json({ items }, 201);
      },
    );
  }

  if (opts.update && opts.service.updateBulk) {
    const schema = buildBulkUpdateSchema();
    routes.patch(
      "/bulk",
      ...middleware,
      validate("json", schema),
      async (c: AdminCrudContext) => {
        const body = (await c.req.json()) as { items: Record<string, unknown>[] };
        const updates = (body.items ?? []).map((row) => {
          const { id, ...data } = row;
          return { id: String(id), data };
        });
        const items = await opts.service.updateBulk!(updates, c);
        return c.json({ items });
      },
    );
  }

  return app;
}
