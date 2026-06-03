import type { BulkUpdateItem, ListQuery, ListResult } from "./list-scope";
import type { InferQueryableInsert, InferQueryableSelect, PgQueryable } from "./pg-queryable";

import type { ServiceContext } from "./service-context";

export abstract class AbstractTableService<
  TTable extends PgQueryable,
  TRow = InferQueryableSelect<TTable>,
  TCreate = InferQueryableInsert<TTable>,
  TUpdate = InferQueryableInsert<TTable>,
  TFilters extends Record<string, unknown> = Record<string, never>,
  TListItem = TRow,
> {
  protected constructor(protected readonly table: TTable) {
    if (new.target === AbstractTableService) {
      throw new Error("AbstractTableService cannot be instantiated directly.");
    }
  }

  abstract get(id: string, ctx?: ServiceContext): Promise<TRow | null>;
  abstract list(query: ListQuery<TFilters>, ctx?: ServiceContext): Promise<ListResult<TListItem>>;
  abstract count(query: ListQuery<TFilters>, ctx?: ServiceContext): Promise<number>;
  abstract create(data: TCreate, ctx?: ServiceContext): Promise<TRow>;
  abstract createBulk(items: TCreate[], ctx?: ServiceContext): Promise<TRow[]>;
  abstract update(id: string, data: TUpdate, ctx?: ServiceContext): Promise<TRow>;
  abstract updateBulk(updates: BulkUpdateItem<TUpdate>[], ctx?: ServiceContext): Promise<TRow[]>;
  abstract delete(id: string, ctx?: ServiceContext): Promise<void>;
}
