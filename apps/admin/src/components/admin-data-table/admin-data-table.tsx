import type { ReactNode } from "react";
import type { AdminColumnDef } from "@/components/admin-data-table/types";
import type { AdminListServiceDefinition } from "@/lib/admin-list-services";
import type { ForeignKeyScope } from "@/lib/admin-fk-services";

import { AdminListPagination } from "@/components/admin-list-pagination";
import { DataTable } from "@/components/ui/data-table";
import {
  useAdminDataTable,
  type AdminDataTableContext,
  type AdminDataTableRowSelection,
} from "@/components/admin-data-table/use-admin-data-table";

export type AdminDataTableProps<
  TRow,
  TScope = undefined,
  TFilters = undefined,
> = {
  service: AdminListServiceDefinition<TRow, TScope, TFilters>;
  columns: AdminColumnDef<TRow>[];
  scope?: TScope;
  filters?: TFilters;
  fkScope?: ForeignKeyScope;
  enabled?: boolean;
  toolbar?: (ctx: AdminDataTableContext<TRow>) => ReactNode;
  emptyMessage?: string;
  rowSelection?: AdminDataTableRowSelection<TRow>;
};

export function AdminDataTable<TRow, TScope = undefined, TFilters = undefined>(
  props: AdminDataTableProps<TRow, TScope, TFilters>,
) {
  const {
    table,
    ctx,
    list,
    enabled = true,
  } = useAdminDataTable({
    service: props.service,
    columns: props.columns,
    scope: props.scope,
    filters: props.filters,
    fkScope: props.fkScope,
    enabled: props.enabled,
    rowSelection: props.rowSelection,
  });

  if (!enabled) {
    return null;
  }

  return (
    <div className="space-y-4">
      {props.toolbar ? props.toolbar(ctx) : null}
      {ctx.error ? (
        <p className="text-sm text-red-400">
          {ctx.error.message || "Failed to load data."}
        </p>
      ) : null}
      <DataTable
        emptyMessage={props.emptyMessage}
        isLoading={ctx.isLoading}
        table={table}
      />
      {ctx.meta ? (
        <AdminListPagination
          idPrefix={props.service.id}
          isLoading={ctx.isLoading || ctx.isFetching}
          meta={ctx.meta}
          page={list.page}
          pageSize={list.pageSize}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
      ) : null}
    </div>
  );
}
