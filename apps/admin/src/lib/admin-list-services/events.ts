import type { EventRow } from "@/lib/admin-api";

import { queryOptions } from "@tanstack/react-query";

import { adminKeys } from "@/hooks/use-admin-api/keys";
import { listEvents } from "@/lib/admin-api";
import { buildAdminListQueryKey, pageToLimitSkip } from "@/lib/admin-list";

import { defineAdminListService, type AdminListQueryOptions } from "./types";

export const eventsListService = defineAdminListService<
  EventRow,
  undefined,
  undefined
>({
  id: "events",
  defaultSort: { field: "title", direction: "asc" },
  listQuery: ({ page, pageSize, sort }) =>
    queryOptions({
      queryKey: adminKeys.events.list(
        buildAdminListQueryKey(page, pageSize, undefined, sort),
      ),
      queryFn: () =>
        listEvents({
          ...pageToLimitSkip(page, pageSize),
          sort,
        }),
    }) as AdminListQueryOptions<EventRow>,
});
