import type { ListResponse } from "@/lib/api-client";
import type { UseQueryOptions } from "@tanstack/react-query";
import type { AdminSortDirection } from "@/lib/admin-list-sort";

export type AdminListQueryOptions<TRow> = UseQueryOptions<
  ListResponse<TRow>,
  Error,
  ListResponse<TRow>
>;

export type AdminListServiceDefinition<
  TRow,
  TScope = undefined,
  TFilters = undefined,
> = {
  readonly id: string;
  readonly defaultSort: { field: string; direction: AdminSortDirection };
  listQuery: (args: {
    page: number;
    pageSize: number;
    sort: string;
    scope?: TScope;
    filters?: TFilters;
  }) => AdminListQueryOptions<TRow>;
};

export function defineAdminListService<
  TRow,
  TScope = undefined,
  TFilters = undefined,
>(
  def: AdminListServiceDefinition<TRow, TScope, TFilters>,
): AdminListServiceDefinition<TRow, TScope, TFilters> {
  return def;
}

export type InferListRow<T> =
  T extends AdminListServiceDefinition<infer R, unknown, unknown> ? R : never;

export type InferListScope<T> =
  T extends AdminListServiceDefinition<unknown, infer S, unknown> ? S : never;

export type InferListFilters<T> =
  T extends AdminListServiceDefinition<unknown, unknown, infer F> ? F : never;
