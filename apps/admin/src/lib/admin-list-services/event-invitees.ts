import type { EventInviteeListRow } from "@/lib/admin-api";

import { queryOptions } from "@tanstack/react-query";

import { adminKeys } from "@/hooks/use-admin-api/keys";
import { listEventInvitees } from "@/lib/admin-api";
import { buildAdminListQueryKey, pageToLimitSkip } from "@/lib/admin-list";

import { defineAdminListService, type AdminListQueryOptions } from "./types";

export type EventInviteesListScope = {
  eventId: string;
};

export type EventInviteesListFilters = {
  orderStatus?: string;
};

export const eventInviteesListService = defineAdminListService<
  EventInviteeListRow,
  EventInviteesListScope,
  EventInviteesListFilters
>({
  id: "eventInvitees",
  defaultSort: { field: "personId", direction: "asc" },
  listQuery: ({ page, pageSize, sort, scope, filters }) =>
    queryOptions({
      queryKey: [
        ...adminKeys.eventInvitees.list(
          buildAdminListQueryKey(
            page,
            pageSize,
            {
              eventId: scope!.eventId,
              ...(filters?.orderStatus
                ? { orderStatus: filters.orderStatus }
                : {}),
            },
            sort,
          ),
        ),
        filters?.orderStatus ?? "",
      ],
      queryFn: () =>
        listEventInvitees({
          ...pageToLimitSkip(page, pageSize),
          eventId: scope!.eventId,
          sort,
          ...(filters?.orderStatus ? { orderStatus: filters.orderStatus } : {}),
        }),
      enabled: Boolean(scope?.eventId),
    }) as AdminListQueryOptions<EventInviteeListRow>,
});
