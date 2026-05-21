import { arktypeValidator } from "@hono/arktype-validator";
import type { Type } from "arktype";
import { Hono } from "hono";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { MiddlewareHandler } from "hono";

import {
  buildArkTypeSchemas,
  type BuildArkTypeSchemasOptions,
} from "./arktype-from-columns";
import { CrudService } from "./crud-service";
import { NotFoundError } from "./errors";
import { introspectPgTable, type IntrospectOptions } from "./introspect";
import type { AdminCrudContext, AdminCrudHooks, CrudOperation } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validate = arktypeValidator as (
  target: "query" | "json",
  schema: unknown,
) => MiddlewareHandler;

export type CrudProviderOptions = IntrospectOptions & {
  getDb: () => unknown;
  operations?: CrudOperation[];
  parent?: {
    param: string;
    column: PgColumn;
  };
  middleware?: MiddlewareHandler[];
  schemas?: BuildArkTypeSchemasOptions;
  /** When set, bypasses auto-generated ArkType for that operation. */
  arkTypes?: {
    create?: Type;
    update?: Type;
    listQuery?: Type;
  };
  list?: {
    searchFields?: PgColumn[];
    filterFields?: Record<string, PgColumn>;
    sortFields?: Record<string, PgColumn>;
    defaultSort?: string;
    maxPageSize?: number;
  };
  hooks?: AdminCrudHooks;
  idColumn?: PgColumn;
};

export function crudProvider<TTable extends PgTable>(
  table: TTable,
  opts: CrudProviderOptions,
): Hono {
  const app = new Hono();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = app as any;
  const operations: CrudOperation[] = opts.operations ?? [
    "list",
    "read",
    "create",
    "update",
    "delete",
  ];
  const middleware = opts.middleware ?? [];
  const meta = introspectPgTable(table, opts);
  const builtSchemas = buildArkTypeSchemas(meta, opts.schemas);
  const createSchema = opts.arkTypes?.create ?? builtSchemas.create;
  const updateSchema = opts.arkTypes?.update ?? builtSchemas.update;
  const listQuerySchema = opts.arkTypes?.listQuery ?? builtSchemas.listQuery;
  const service = new CrudService({
    table,
    meta,
    getDb: opts.getDb,
    parent: opts.parent,
    hooks: opts.hooks,
    list: opts.list,
  });

  if (operations.includes("list")) {
    routes.get(
      "/",
      ...middleware,
      validate("query", listQuerySchema),
      async (c: AdminCrudContext) => {
        const query = c.req.query() as Record<string, string | undefined>;
        const { items, meta: listMeta } = await service.list(query, c);
        return c.json({ items, meta: listMeta });
      },
    );
  }

  if (operations.includes("read")) {
    routes.get("/:id", ...middleware, async (c: AdminCrudContext) => {
      const id = c.req.param("id");
      const row = await service.getOne(id, c);
      if (!row) {
        return c.json({ error: "Not found." }, 404);
      }
      return c.json({ item: row });
    });
  }

  if (operations.includes("create") && createSchema) {
    routes.post(
      "/",
      ...middleware,
      validate("json", createSchema),
      async (c: AdminCrudContext) => {
        const body = (await c.req.json()) as Record<string, unknown>;
        const item = await service.create(body, c);
        return c.json({ item }, 201);
      },
    );
  }

  if (operations.includes("update") && updateSchema) {
    routes.patch(
      "/:id",
      ...middleware,
      validate("json", updateSchema),
      async (c: AdminCrudContext) => {
        const id = c.req.param("id");
        const body = (await c.req.json()) as Record<string, unknown>;
        try {
          const item = await service.update(id, body, c);
          return c.json({ item });
        } catch (e) {
          if (e instanceof NotFoundError) {
            return c.json({ error: e.message }, 404);
          }
          throw e;
        }
      },
    );
  }

  if (operations.includes("delete")) {
    routes.delete("/:id", ...middleware, async (c: AdminCrudContext) => {
      const id = c.req.param("id");
      try {
        await service.delete(id, c);
        return c.body(null, 204);
      } catch (e) {
        if (e instanceof NotFoundError) {
          return c.json({ error: e.message }, 404);
        }
        throw e;
      }
    });
  }

  return app;
}
