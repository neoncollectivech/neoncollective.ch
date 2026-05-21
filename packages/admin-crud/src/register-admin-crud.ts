import type { Hono } from "hono";

import { crudProvider } from "./crud-provider";
import type { AdminCrudConfig } from "./types";

function resourcePath(config: AdminCrudConfig): string {
  const base = config.basePath?.replace(/\/$/, "") ?? "";
  return `${base}/${config.resource}`;
}

/**
 * @deprecated Prefer `crudProvider(table, opts)` mounted with `app.route(path, sub)`.
 */
export function registerAdminCrud(app: Hono, config: AdminCrudConfig): void {
  const path = resourcePath(config);
  const sub = crudProvider(config.table, {
    getDb: config.getDb,
    operations: config.operations,
    parent: config.parent,
    middleware: config.middleware,
    idColumn: config.idColumn,
    hooks: config.hooks,
    fields: config.fields,
    list: {
      searchFields: config.searchFields,
      filterFields: config.filterFields,
      sortFields: config.sortFields,
      defaultSort: config.defaultSort,
    },
    arkTypes: {
      create: config.schemas?.create,
      update: config.schemas?.update,
      listQuery: config.schemas?.listQuery,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).route(path, sub);
}
