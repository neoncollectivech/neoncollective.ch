import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { BadRequestError, NotFoundError } from "./errors";
import type { AdminTableMeta } from "./introspect";
import { runAdminList } from "./list-handler";
import { pickFields, projectRow } from "./row-utils";
import type { AdminListMeta, AdminListQuery } from "./schemas";
import type { AdminCrudContext, AdminCrudHooks } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

export type CrudServiceParent = {
  param: string;
  column: PgColumn;
};

export type CrudServiceConfig<TTable extends PgTable> = {
  table: TTable;
  meta: AdminTableMeta;
  getDb: () => AnyDb;
  parent?: CrudServiceParent;
  hooks?: AdminCrudHooks;
  list?: {
    searchFields?: PgColumn[];
    filterFields?: Record<string, PgColumn>;
    sortFields?: Record<string, PgColumn>;
    defaultSort?: string;
    maxPageSize?: number;
  };
};

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

export class CrudService<TTable extends PgTable> {
  readonly #table: TTable;
  readonly #meta: AdminTableMeta;
  readonly #getDb: () => AnyDb;
  readonly #parent?: CrudServiceParent;
  readonly #hooks?: AdminCrudHooks;
  readonly #list: CrudServiceConfig<TTable>["list"];

  constructor(config: CrudServiceConfig<TTable>) {
    this.#table = config.table;
    this.#meta = config.meta;
    this.#getDb = config.getDb;
    this.#parent = config.parent;
    this.#hooks = config.hooks;
    this.#list = config.list;
  }

  async parentWhere(c: AdminCrudContext): Promise<SQL | undefined> {
    if (!this.#parent) {
      return undefined;
    }
    const parentId = c.req.param(this.#parent.param);
    if (!parentId) {
      throw new BadRequestError(`Missing parent param ${this.#parent.param}.`);
    }
    return eq(this.#parent.column, parentId);
  }

  async list(
    query: AdminListQuery & Record<string, string | undefined>,
    c: AdminCrudContext,
  ): Promise<{ items: Record<string, unknown>[]; meta: AdminListMeta }> {
    const db = this.#getDb();
    const parent = await this.parentWhere(c);
    const hookWhere = await this.#hooks?.listWhere?.(c);
    const extraWhere = combineWhere(parent, hookWhere);

    const { rows, meta } = await runAdminList({
      db,
      table: this.#table,
      query,
      idColumn: this.#meta.idColumn,
      searchFields: this.#list?.searchFields ?? this.#meta.searchFields,
      filterFields: this.#list?.filterFields ?? this.#meta.filterFields,
      sortFields: this.#list?.sortFields ?? this.#meta.sortFields,
      defaultSort: this.#list?.defaultSort ?? this.#meta.defaultSort,
      extraWhere,
      maxPageSize: this.#list?.maxPageSize,
    });

    const items = rows.map((row) => projectRow(row, this.#meta.project.list));
    return { items, meta };
  }

  async getOne(id: string, c: AdminCrudContext): Promise<Record<string, unknown> | undefined> {
    const db = this.#getDb();
    const where = combineWhere(eq(this.#meta.idColumn, id), await this.parentWhere(c));
    const row = await selectOneRow(db, this.#table, where);
    if (!row) {
      return undefined;
    }
    return projectRow(row, this.#meta.project.read);
  }

  async create(body: Record<string, unknown>, c: AdminCrudContext): Promise<Record<string, unknown>> {
    let data = pickFields(body, this.#meta.writable.create);
    if (this.#hooks?.beforeCreate) {
      data = await this.#hooks.beforeCreate(data, c);
    }

    const db = this.#getDb();
    const inserted = await db.insert(this.#table).values(data).returning();
    const row = inserted[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Insert did not return a row.");
    }
    return projectRow(row, this.#meta.project.read);
  }

  async update(
    id: string,
    body: Record<string, unknown>,
    c: AdminCrudContext,
  ): Promise<Record<string, unknown>> {
    const db = this.#getDb();
    const where = combineWhere(eq(this.#meta.idColumn, id), await this.parentWhere(c));

    const existing = await selectOneRow(db, this.#table, where);
    if (!existing) {
      throw new NotFoundError();
    }

    let data = pickFields(body, this.#meta.writable.update);
    if (this.#hooks?.beforeUpdate) {
      data = await this.#hooks.beforeUpdate(id, data, c);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestError("No fields to update.");
    }

    const updated = await db.update(this.#table).set(data).where(where).returning();
    const row = updated[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new NotFoundError();
    }
    return projectRow(row, this.#meta.project.read);
  }

  async delete(id: string, c: AdminCrudContext): Promise<void> {
    const db = this.#getDb();
    const where = combineWhere(eq(this.#meta.idColumn, id), await this.parentWhere(c));

    const existing = await selectOneRow(db, this.#table, where);
    if (!existing) {
      throw new NotFoundError();
    }

    await this.#hooks?.beforeDelete?.(id, c);
    await db.delete(this.#table).where(where);
  }
}
