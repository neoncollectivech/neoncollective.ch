import {
  TableService as BaseTableService,
  type TableServiceConfig as BaseTableServiceConfig,
} from "@neon/resource-api";
import type {
  FilterableColumn,
  InferQueryableInsert,
  InferQueryableSelect,
  PgQueryable,
  ResourceMeta,
} from "@neon/resource-api";

import { getDb } from "../../db/index";

export type TableServiceConfig<
  TTable extends PgQueryable,
  TFilterable extends readonly FilterableColumn[] = ResourceMeta["filterable"],
> = Omit<BaseTableServiceConfig<TTable, TFilterable>, "getDb">;

export class TableService<
  TTable extends PgQueryable,
  TRow = InferQueryableSelect<TTable>,
  TCreate = InferQueryableInsert<TTable>,
  TUpdate = InferQueryableInsert<TTable>,
  TFilters extends Record<string, unknown> = Record<string, never>,
  TListItem = TRow,
  TFilterable extends readonly FilterableColumn[] = readonly FilterableColumn[],
> extends BaseTableService<TTable, TRow, TCreate, TUpdate, TFilters, TListItem, TFilterable> {
  constructor(config: TableServiceConfig<TTable, TFilterable>) {
    super({ ...config, getDb: () => getDb() });
  }
}
