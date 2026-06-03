import type {
  AdmissionRow,
  EventInviteeListRow,
  EventPromotionCodeRow,
  EventRow,
  OrderRow,
  PersonRow,
} from "@/lib/admin-api";

import { adminKeys } from "@/hooks/use-admin-api/keys";
import {
  listEventInvitees,
  listAdmissions,
  listEventPromotionCodesPaginated,
  listEvents,
  listOrders,
  listPeople,
} from "@/lib/admin-api";

import { createAdminListService } from "./create";

export const eventsListService = createAdminListService<
  EventRow,
  undefined,
  undefined
>({
  defaultSort: { field: "title", direction: "asc" },
  keys: adminKeys.events,
  listFn: listEvents,
});

export type OrdersListScope = {
  eventId: string;
};

export const ordersListService = createAdminListService<
  OrderRow,
  OrdersListScope,
  undefined
>({
  defaultSort: { field: "createdAt", direction: "desc" },
  keys: adminKeys.orders,
  listFn: listOrders,
  buildQueryParams: ({ scope }) => ({
    eventId: scope?.eventId,
  }),
  queryKeyExtra: ({ scope }) => [scope?.eventId ?? ""],
  enabled: (scope) => Boolean(scope?.eventId),
});

export type PeopleListFilters = {
  q?: string;
};

export const peopleListService = createAdminListService<
  PersonRow,
  undefined,
  PeopleListFilters
>({
  defaultSort: { field: "givenName", direction: "asc" },
  keys: adminKeys.people,
  listFn: listPeople,
  buildQueryParams: ({ filters }) => (filters?.q ? { q: filters.q } : {}),
  queryKeyExtra: ({ filters }) => [filters?.q ?? ""],
});

export type EventInviteesListScope = {
  eventId: string;
};

export type EventInviteesListFilters = {
  orderStatus?: string;
};

export const eventInviteesListService = createAdminListService<
  EventInviteeListRow,
  EventInviteesListScope,
  EventInviteesListFilters
>({
  defaultSort: { field: "createdAt", direction: "desc" },
  keys: adminKeys.eventInvitees,
  listFn: listEventInvitees,
  buildQueryParams: ({ scope, filters }) => ({
    eventId: scope?.eventId,
    ...(filters?.orderStatus ? { orderStatus: filters.orderStatus } : {}),
  }),
  queryKeyExtra: ({ filters }) => [filters?.orderStatus ?? ""],
  enabled: (scope) => Boolean(scope?.eventId),
});

export type EventPromotionCodesListScope = {
  eventId: string;
};

export type AdmissionsListScope = {
  eventId: string;
};

export const admissionsListService = createAdminListService<
  AdmissionRow,
  AdmissionsListScope
>({
  defaultSort: { field: "createdAt", direction: "desc" },
  keys: adminKeys.admissions,
  listFn: listAdmissions,
  buildQueryParams: ({ scope }) => ({
    eventId: scope?.eventId,
  }),
  queryKeyExtra: ({ scope }) => [scope?.eventId ?? ""],
  enabled: (scope) => Boolean(scope?.eventId),
});

export const eventPromotionCodesListService = createAdminListService<
  EventPromotionCodeRow,
  EventPromotionCodesListScope
>({
  defaultSort: { field: "createdAt", direction: "desc" },
  keys: adminKeys.promotionCodes,
  listFn: (params) => {
    const eventId = params.eventId;

    if (!eventId) {
      throw new Error("eventPromotionCodesListService requires eventId");
    }

    return listEventPromotionCodesPaginated(eventId, params);
  },
  buildQueryParams: ({ scope }) => ({
    eventId: scope?.eventId,
  }),
  queryKeyExtra: ({ scope }) => [scope?.eventId ?? ""],
  enabled: (scope) => Boolean(scope?.eventId),
});
