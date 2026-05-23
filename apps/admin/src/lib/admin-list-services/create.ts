import type { AdminListRequestParams } from "@/lib/admin-api";
import type { ListResponse } from "@/lib/api-client";
import type { AdminSortDirection } from "@/lib/admin-list-sort";

import { queryOptions } from "@tanstack/react-query";

import { buildAdminListQueryKey, pageToLimitSkip } from "@/lib/admin-list";

import { defineAdminListService, type AdminListQueryOptions } from "./types";

type ListKeys = {
  list: (params: Record<string, string>) => readonly unknown[];
};

export type CreateAdminListServiceConfig<
  TRow,
  TScope = undefined,
  TFilters = undefined,
> = {
  defaultSort: { field: string; direction: AdminSortDirection };
  keys: ListKeys;
  listFn: (params: AdminListRequestParams) => Promise<ListResponse<TRow>>;
  buildQueryParams?: (args: {
    page: number;
    pageSize: number;
    sort: string;
    scope?: TScope;
    filters?: TFilters;
  }) => Record<string, string | undefined>;
  queryKeyExtra?: (args: {
    scope?: TScope;
    filters?: TFilters;
  }) => readonly unknown[];
  enabled?: (scope?: TScope) => boolean;
};

export function createAdminListService<
  TRow,
  TScope = undefined,
  TFilters = undefined,
>(config: CreateAdminListServiceConfig<TRow, TScope, TFilters>) {
  return defineAdminListService<TRow, TScope, TFilters>({
    id: "admin-list",
    defaultSort: config.defaultSort,
    listQuery: ({ page, pageSize, sort, scope, filters }) => {
      const extraParams = config.buildQueryParams?.({
        page,
        pageSize,
        sort,
        scope,
        filters,
      });
      const queryKeyParams = Object.fromEntries(
        Object.entries(extraParams ?? {}).filter(
          (entry): entry is [string, string] =>
            entry[1] != null && entry[1] !== "",
        ),
      );

      return queryOptions({
        queryKey: [
          ...config.keys.list(
            buildAdminListQueryKey(page, pageSize, queryKeyParams, sort),
          ),
          ...(config.queryKeyExtra?.({ scope, filters }) ?? []),
        ],
        queryFn: () =>
          config.listFn({
            ...pageToLimitSkip(page, pageSize),
            sort,
            ...extraParams,
          }),
        enabled: config.enabled?.(scope) ?? true,
      }) as AdminListQueryOptions<TRow>;
    },
  });
}
