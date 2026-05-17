import { arktypeValidator } from "@hono/arktype-validator";
import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Hono, MiddlewareHandler } from "hono";

import { BadRequestError, NotFoundError } from "./errors.js";
import { runAdminList } from "./list-handler.js";
import { adminListQuerySchema, type AdminListQuery } from "./schemas.js";
import type { AdminCrudConfig, AdminCrudContext, CrudOperation } from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

const validate = arktypeValidator as (
  target: "query" | "json",
  schema: unknown,
) => MiddlewareHandler;

function pickFields(
  source: Record<string, unknown>,
  allowed: string[] | undefined,
): Record<string, unknown> {
  if (!allowed?.length) {
    return source;
  }
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in source) {
      out[key] = source[key];
    }
  }
  return out;
}

function projectRow(
  row: Record<string, unknown>,
  fields: string[] | "*" | undefined,
): Record<string, unknown> {
  if (!fields || fields === "*") {
    return row;
  }
  const out: Record<string, unknown> = {};
  for (const key of fields) {
    if (key in row) {
      out[key] = row[key];
    }
  }
  return out;
}

function resourcePath(config: AdminCrudConfig): string {
  const base = config.basePath?.replace(/\/$/, "") ?? "";
  return `${base}/${config.resource}`;
}

async function selectOneRow(
  db: AnyDb,
  table: PgTable,
  where: SQL | undefined,
): Promise<Record<string, unknown> | undefined> {
  const rows = (await db.select().from(table).where(where).limit(1)) as Record<
    string,
    unknown
  >[];
  return rows[0];
}

function resolveIdColumn(config: AdminCrudConfig): PgColumn {
  if (config.idColumn) {
    return config.idColumn;
  }
  const table = config.table as PgTable & { id: PgColumn };
  if (!table.id) {
    throw new Error(`registerAdminCrud: table for "${config.resource}" has no id column`);
  }
  return table.id;
}

async function parentWhere(config: AdminCrudConfig, c: AdminCrudContext): Promise<SQL | undefined> {
  if (!config.parent) {
    return undefined;
  }
  const parentId = c.req.param(config.parent.param);
  if (!parentId) {
    throw new BadRequestError(`Missing parent param ${config.parent.param}.`);
  }
  return eq(config.parent.column, parentId);
}

async function applySerialize(
  serialize: AdminCrudConfig["serialize"],
  row: Record<string, unknown>,
  c: AdminCrudContext,
): Promise<unknown> {
  const fn = serialize ?? ((r: Record<string, unknown>) => r);
  return await Promise.resolve(fn(row, c));
}

function combineWhere(...parts: (SQL | undefined)[]): SQL | undefined {
  const filtered = parts.filter((p): p is SQL => p !== undefined);
  if (filtered.length === 0) {
    return undefined;
  }
  if (filtered.length === 1) {
    return filtered[0];
  }
  return and(...filtered);
}

export function registerAdminCrud(app: Hono, config: AdminCrudConfig): void {
  // Hono + arktype middleware chaining does not infer Env; routes are registered dynamically.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = app as any;
  const operations: CrudOperation[] = config.operations ?? [
    "list",
    "read",
    "create",
    "update",
    "delete",
  ];
  const idColumn = resolveIdColumn(config);
  const path = resourcePath(config);
  const middleware = config.middleware ?? [];

  const listQuerySchema = config.schemas?.listQuery ?? adminListQuerySchema;

  if (operations.includes("list")) {
    routes.get(
      path,
      ...middleware,
      validate("query", listQuerySchema),
      async (c: AdminCrudContext) => {
        const db = config.getDb();
        const parent = await parentWhere(config, c);
        const hookWhere = await config.hooks?.listWhere?.(c);
        const extraWhere = combineWhere(parent, hookWhere);

        const query = c.req.query() as AdminListQuery & Record<string, string | undefined>;
        const { rows, meta } = await runAdminList({
          db,
          table: config.table,
          query,
          idColumn,
          searchFields: config.searchFields,
          filterFields: config.filterFields,
          sortFields: config.sortFields,
          defaultSort: config.defaultSort,
          extraWhere,
        });

        const items = await Promise.all(
          rows.map(async (row) => {
            const projected = projectRow(row, config.fields.list);
            return applySerialize(config.serialize, projected, c);
          }),
        );

        return c.json({ items, meta });
      },
    );
  }

  if (operations.includes("read")) {
    routes.get(`${path}/:id`, ...middleware, async (c: AdminCrudContext) => {
      const db = config.getDb();
      const id = c.req.param("id");
      const where = combineWhere(eq(idColumn, id), await parentWhere(config, c));

      const row = await selectOneRow(db, config.table, where);
      if (!row) {
        return c.json({ error: "Not found." }, 404);
      }

      const projected = projectRow(row, config.fields.read);
      const item = await applySerialize(config.serialize, projected, c);
      return c.json({ item });
    });
  }

  if (operations.includes("create") && config.schemas?.create) {
    routes.post(
      path,
      ...middleware,
      validate("json", config.schemas.create),
      async (c: AdminCrudContext) => {
        const body = (await c.req.json()) as Record<string, unknown>;
        let data = pickFields(body, config.fields.create);
        if (config.hooks?.beforeCreate) {
          data = await config.hooks.beforeCreate(data, c);
        }

        const db = config.getDb() as AnyDb;
        const inserted = await db.insert(config.table).values(data).returning();

        const row = inserted[0] as Record<string, unknown> | undefined;
        if (!row) {
          throw new Error("Insert did not return a row.");
        }

        const projected = projectRow(row, config.fields.read ?? "*");
        const item = await applySerialize(config.serialize, projected, c);
        return c.json({ item }, 201);
      },
    );
  }

  if (operations.includes("update") && config.schemas?.update) {
    routes.patch(
      `${path}/:id`,
      ...middleware,
      validate("json", config.schemas.update),
      async (c: AdminCrudContext) => {
        const db = config.getDb();
        const id = c.req.param("id");
        const where = combineWhere(eq(idColumn, id), await parentWhere(config, c));

        const existing = await selectOneRow(db, config.table, where);
        if (!existing) {
          return c.json({ error: "Not found." }, 404);
        }

        const body = (await c.req.json()) as Record<string, unknown>;
        let data = pickFields(body, config.fields.update);
        if (config.hooks?.beforeUpdate) {
          data = await config.hooks.beforeUpdate(id, data, c);
        }

        if (Object.keys(data).length === 0) {
          return c.json({ error: "No fields to update." }, 400);
        }

        const updated = await (db as AnyDb)
          .update(config.table)
          .set(data)
          .where(where)
          .returning();

        const row = updated[0] as Record<string, unknown> | undefined;
        if (!row) {
          throw new NotFoundError();
        }

        const projected = projectRow(row, config.fields.read ?? "*");
        const item = await applySerialize(config.serialize, projected, c);
        return c.json({ item });
      },
    );
  }

  if (operations.includes("delete")) {
    routes.delete(`${path}/:id`, ...middleware, async (c: AdminCrudContext) => {
      const db = config.getDb();
      const id = c.req.param("id");
      const where = combineWhere(eq(idColumn, id), await parentWhere(config, c));

      const existing = await selectOneRow(db, config.table, where);
      if (!existing) {
        return c.json({ error: "Not found." }, 404);
      }

      await config.hooks?.beforeDelete?.(id, c);

      await (db as AnyDb).delete(config.table).where(where);
      return c.body(null, 204);
    });
  }
}
