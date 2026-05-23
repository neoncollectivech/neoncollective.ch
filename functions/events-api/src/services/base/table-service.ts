import {
  TableService as BaseTableService,
  type TableServiceConfig as BaseTableServiceConfig,
} from "@neon/resource-api";
import type { FilterableColumn } from "@neon/resource-api";
import type { ResourceMeta } from "@neon/resource-api";
import type { PgTable } from "drizzle-orm/pg-core";

import { getDb } from "../../db/index";

export type TableServiceConfig<
  TTable extends PgTable,
  TFilterable extends readonly FilterableColumn[] = ResourceMeta["filterable"],
> = Omit<BaseTableServiceConfig<TTable, TFilterable>, "getDb">;

export class TableService<
  TTable extends PgTable,
  TRow = import("drizzle-orm").InferSelectModel<TTable>,
  TCreate = Partial<import("drizzle-orm").InferInsertModel<TTable>>,
  TUpdate = Partial<import("drizzle-orm").InferInsertModel<TTable>>,
  TFilters extends Record<string, unknown> = Record<string, never>,
  TListItem = TRow,
  TFilterable extends readonly FilterableColumn[] = readonly FilterableColumn[],
> extends BaseTableService<TTable, TRow, TCreate, TUpdate, TFilters, TListItem, TFilterable> {
  constructor(config: TableServiceConfig<TTable, TFilterable>) {
    super({ ...config, getDb: () => getDb() });
  }
}
