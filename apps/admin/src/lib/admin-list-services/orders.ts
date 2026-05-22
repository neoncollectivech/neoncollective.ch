import type { OrderRow } from "@/lib/admin-api";

import { queryOptions } from "@tanstack/react-query";

import { adminKeys } from "@/hooks/use-admin-api/keys";
import { listOrders } from "@/lib/admin-api";
import { buildAdminListQueryKey, pageToLimitSkip } from "@/lib/admin-list";

import { defineAdminListService, type AdminListQueryOptions } from "./types";

export const ordersListService = defineAdminListService<
  OrderRow,
  undefined,
  undefined
>({
  id: "orders",
  defaultSort: { field: "createdAt", direction: "desc" },
  listQuery: ({ page, pageSize, sort }) =>
    queryOptions({
      queryKey: adminKeys.orders.list(
        buildAdminListQueryKey(page, pageSize, undefined, sort),
      ),
      queryFn: () =>
        listOrders({
          ...pageToLimitSkip(page, pageSize),
          sort,
        }),
    }) as AdminListQueryOptions<OrderRow>,
});
