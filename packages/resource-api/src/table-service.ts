import {
  listMetaFromScope,
  resolveAdminListScope,
  runAdminListFromScope,
  type BulkUpdateItem,
  type ListQuery,
  type ListResult,
} from "./list-scope";
import type { FilterableColumn } from "./filter-types";
import type { ResourceMeta } from "./introspect";
import { BadRequestError, NotFoundError } from "./errors";
import { and, count, eq, type SQL } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { AbstractTableService } from "./abstract-table-service";
import { BulkLimitError } from "./errors";
import { parentSqlFromCtx } from "./service-context";
import { pickTableColumns, pickWritable, projectRow } from "./row-utils";
import type { ServiceContext } from "./service-context";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

export type TableServiceConfig<
  TTable extends PgTable,
  TFilterable extends readonly FilterableColumn[] = ResourceMeta["filterable"],
> = {
  table: TTable;
  meta: ResourceMeta;
  getDb: () => AnyDb;
  /** Defaults to `meta.filterable` from table introspection. */
  filterable?: TFilterable;
  searchFields?: PgColumn[];
  sortFields?: Record<string, PgColumn>;
  defaultSort?: string;
  listProject?: string[];
  maxPageSize?: number;
  maxBulkSize?: number;
  writableCreate?: string[];
  writableUpdate?: string[];
};

export class TableService<
  TTable extends PgTable,
  TRow = InferSelectModel<TTable>,
  TCreate = Partial<InferInsertModel<TTable>>,
  TUpdate = Partial<InferInsertModel<TTable>>,
  TFilters extends Record<string, unknown> = Record<string, never>,
  TListItem = TRow,
  TFilterable extends readonly FilterableColumn[] = readonly FilterableColumn[],
> extends AbstractTableService<TTable, TRow, TCreate, TUpdate, TFilters, TListItem> {
  readonly #meta: ResourceMeta;
  readonly #filterable: TFilterable;
  readonly #searchFields: PgColumn[];
  readonly #sortFields: Record<string, PgColumn>;
  readonly #defaultSort: string;
  readonly #listProject: string[];
  readonly #maxPageSize: number;
  readonly #maxBulkSize: number;
  readonly #writableCreate: string[];
  readonly #writableUpdate: string[];
  readonly #getDb: () => AnyDb;

  constructor(config: TableServiceConfig<TTable, TFilterable>) {
    super(config.table);
    this.#meta = config.meta;
    this.#getDb = config.getDb;
    this.#filterable = (config.filterable ?? config.meta.filterable) as TFilterable;
    this.#searchFields = config.searchFields ?? config.meta.searchFields;
    this.#sortFields = config.sortFields ?? config.meta.sortFields;
    this.#defaultSort = config.defaultSort ?? config.meta.defaultSort;
    this.#listProject = config.listProject ?? config.meta.project.list;
    this.#maxPageSize = config.maxPageSize ?? 100;
    this.#maxBulkSize = config.maxBulkSize ?? 100;
    this.#writableCreate = config.writableCreate ?? config.meta.writable.create;
    this.#writableUpdate = config.writableUpdate ?? config.meta.writable.update;
  }

  protected get meta(): ResourceMeta {
    return this.#meta;
  }

  /** Exposed for admin HTTP bridge and schema wiring. */
  get resourceMeta(): ResourceMeta {
    return this.#meta;
  }

  protected get filterable(): TFilterable {
    return this.#filterable;
  }

  protected getDb(): AnyDb {
    return this.#getDb();
  }

  protected async listWhere(_ctx?: ServiceContext): Promise<SQL | undefined> {
    return undefined;
  }

  protected async applyListFilters(
    _query: ListQuery<TFilters>,
    _ctx?: ServiceContext,
  ): Promise<SQL[]> {
    return [];
  }

  protected async beforeCreate(data: TCreate, _ctx?: ServiceContext): Promise<TCreate> {
    return data;
  }

  protected async beforeUpdate(
    _id: string,
    data: TUpdate,
    _ctx?: ServiceContext,
  ): Promise<TUpdate> {
    return data;
  }

  protected async beforeDelete(_id: string, _ctx?: ServiceContext): Promise<void> {}

  protected async beforeCreateBulk(items: TCreate[], ctx?: ServiceContext): Promise<TCreate[]> {
    return Promise.all(items.map((item) => this.beforeCreate(item, ctx)));
  }

  protected async beforeUpdateBulk(
    updates: BulkUpdateItem<TUpdate>[],
    ctx?: ServiceContext,
  ): Promise<BulkUpdateItem<TUpdate>[]> {
    return Promise.all(
      updates.map(async (u) => ({
        id: u.id,
        data: await this.beforeUpdate(u.id, u.data, ctx),
      })),
    );
  }

  /** Override to `"custom"` when list/count need joins or enriched DTOs. */
  protected listExecution(): "table" | "custom" {
    return "table";
  }

  protected async executeCustomList(
    _query: ListQuery<TFilters>,
    _ctx?: ServiceContext,
  ): Promise<ListResult<TListItem>> {
    throw new Error("executeCustomList not implemented");
  }

  protected async executeCustomCount(
    _query: ListQuery<TFilters>,
    _ctx?: ServiceContext,
  ): Promise<number> {
    throw new Error("executeCustomCount not implemented");
  }

  protected async resolveListScope(query: ListQuery<TFilters>, ctx?: ServiceContext) {
    const parent = parentSqlFromCtx(ctx);
    const hookWhere = await this.listWhere(ctx);
    const extraFilters = await this.applyListFilters(query, ctx);
    const extraWhere =
      extraFilters.length > 0 ? and(...extraFilters) : undefined;
    const combined = [parent, hookWhere, extraWhere].filter((p): p is SQL => p !== undefined);
    const extraWhereAll = combined.length > 0 ? and(...combined) : undefined;

    return resolveAdminListScope(
      {
        query: query as ListQuery<Record<string, never>>,
        filterable: this.#filterable,
        searchFields: this.#searchFields,
        sortFields: this.#sortFields,
        defaultSort: this.#defaultSort,
        extraWhere: extraWhereAll,
        maxPageSize: this.#maxPageSize,
      },
      this.#meta.idColumn,
    );
  }

  async get(id: string, ctx?: ServiceContext): Promise<TRow | null> {
    const db = this.getDb();
    const parent = parentSqlFromCtx(ctx);
    const where = parent
      ? and(eq(this.#meta.idColumn, id), parent)
      : eq(this.#meta.idColumn, id);
    const rows = (await db.select().from(this.table).where(where).limit(1)) as TRow[];
    return rows[0] ?? null;
  }

  async getForAdmin(id: string, ctx?: ServiceContext): Promise<Record<string, unknown> | null> {
    const row = await this.get(id, ctx);
    if (!row) {
      return null;
    }
    const readProject = this.#meta.project.read;
    if (readProject === "*") {
      return row as Record<string, unknown>;
    }
    return projectRow(row as Record<string, unknown>, readProject);
  }

  /** Default table-backed list (used by subclasses when custom list defers to standard). */
  protected async listFromTable(
    query: ListQuery<TFilters>,
    ctx?: ServiceContext,
  ): Promise<ListResult<TListItem>> {
    const scope = await this.resolveListScope(query, ctx);
    const db = this.getDb();
    const { rows, total } = await runAdminListFromScope({
      db,
      table: this.table,
      scope,
    });
    const items = rows.map((row) =>
      projectRow(row, this.#listProject),
    ) as TListItem[];
    return { items, meta: listMetaFromScope(scope, total) };
  }

  /** Default table-backed count (used by subclasses when custom count defers to standard). */
  protected async countFromTable(
    query: ListQuery<TFilters>,
    ctx?: ServiceContext,
  ): Promise<number> {
    const scope = await this.resolveListScope(query, ctx);
    const db = this.getDb();
    const [countRow] = (await db
      .select({ total: count() })
      .from(this.table)
      .where(scope.where)) as { total: number }[];
    return Number(countRow?.total ?? 0);
  }

  async list(query: ListQuery<TFilters>, ctx?: ServiceContext): Promise<ListResult<TListItem>> {
    if (this.listExecution() === "custom") {
      return this.executeCustomList(query, ctx);
    }
    return this.listFromTable(query, ctx);
  }

  async count(query: ListQuery<TFilters>, ctx?: ServiceContext): Promise<number> {
    if (this.listExecution() === "custom") {
      return this.executeCustomCount(query, ctx);
    }
    return this.countFromTable(query, ctx);
  }

  async create(data: TCreate, ctx?: ServiceContext): Promise<TRow> {
    let payload = pickWritable(data as Record<string, unknown>, this.#writableCreate) as TCreate;
    payload = await this.beforeCreate(payload, ctx);
    const db = this.getDb();
    const inserted = (await db.insert(this.table).values(payload).returning()) as TRow[];
    const row = inserted[0];
    if (!row) {
      throw new Error("Insert did not return a row.");
    }
    return row;
  }

  async createBulk(items: TCreate[], ctx?: ServiceContext): Promise<TRow[]> {
    if (items.length === 0) {
      return [];
    }
    if (items.length > this.#maxBulkSize) {
      throw new BulkLimitError(this.#maxBulkSize);
    }
    const db = this.getDb();
    const prepared = await this.beforeCreateBulk(items, ctx);
    const rows = (await db.transaction(async (tx: AnyDb) => {
      const payloads = prepared.map((item) =>
        pickWritable(item as Record<string, unknown>, this.#writableCreate),
      );
      return tx.insert(this.table).values(payloads).returning();
    })) as TRow[];
    return rows;
  }

  async update(id: string, data: TUpdate, ctx?: ServiceContext): Promise<TRow> {
    const existing = await this.get(id, ctx);
    if (!existing) {
      throw new NotFoundError();
    }
    const prepared = await this.beforeUpdate(id, data, ctx);
    const payload = pickTableColumns(
      prepared as Record<string, unknown>,
      Object.keys(this.#meta.columns),
    );
    if (Object.keys(payload).length === 0) {
      throw new BadRequestError("No fields to update.");
    }
    const db = this.getDb();
    const parent = parentSqlFromCtx(ctx);
    const where = parent
      ? and(eq(this.#meta.idColumn, id), parent)
      : eq(this.#meta.idColumn, id);
    const updated = (await db.update(this.table).set(payload).where(where).returning()) as TRow[];
    const row = updated[0];
    if (!row) {
      throw new NotFoundError();
    }
    return row;
  }

  async updateBulk(updates: BulkUpdateItem<TUpdate>[], ctx?: ServiceContext): Promise<TRow[]> {
    if (updates.length === 0) {
      return [];
    }
    if (updates.length > this.#maxBulkSize) {
      throw new BulkLimitError(this.#maxBulkSize);
    }
    const db = this.getDb();
    const prepared = await this.beforeUpdateBulk(updates, ctx);
    return db.transaction(async (tx: AnyDb) => {
      const rows: TRow[] = [];
      for (const { id, data } of prepared) {
        const payload = pickTableColumns(
          data as Record<string, unknown>,
          Object.keys(this.#meta.columns),
        );
        if (Object.keys(payload).length === 0) {
          continue;
        }
        const parent = parentSqlFromCtx(ctx);
        const where = parent
          ? and(eq(this.#meta.idColumn, id), parent)
          : eq(this.#meta.idColumn, id);
        const updated = (await tx
          .update(this.table)
          .set(payload)
          .where(where)
          .returning()) as TRow[];
        if (updated[0]) {
          rows.push(updated[0]);
        }
      }
      return rows;
    });
  }

  async delete(id: string, ctx?: ServiceContext): Promise<void> {
    const existing = await this.get(id, ctx);
    if (!existing) {
      throw new NotFoundError();
    }
    await this.beforeDelete(id, ctx);
    const db = this.getDb();
    const parent = parentSqlFromCtx(ctx);
    const where = parent
      ? and(eq(this.#meta.idColumn, id), parent)
      : eq(this.#meta.idColumn, id);
    await db.delete(this.table).where(where);
  }
}
