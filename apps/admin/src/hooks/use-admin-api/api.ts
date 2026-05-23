import type { TierRow } from "@/lib/admin-types";
import type { InviteeUpsertPayload } from "@/lib/parse-invitees-csv";

import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  addEventInvitee,
  createEvent,
  ensureInviteeLink,
  getEvent,
  getEventInvitee,
  getOrder,
  getPerson,
  listEventInvitees,
  listEvents,
  listEventTiers,
  listInviteLinks,
  listInviteRedemptions,
  listAdmissions,
  listOrderTiers,
  listOrders,
  listPeople,
  patchEvent,
  patchEventInvitee,
  patchInviteLink,
  patchPerson,
  putEventTiers,
  deleteInviteLink,
  deleteOrder,
  refundOrder,
  regenerateInviteeLink,
  revokeEventInvitee,
  upsertEventInvitees,
  verifyPeople,
} from "@/lib/admin-api";
import { getApiErrorMessage } from "@/lib/api-error";
import { queryClient } from "@/lib/query-client";
import {
  buildAdminListQueryKey,
  pageToLimitSkip,
  toIdInParam,
} from "@/lib/admin-list";
import { relatedListParams } from "@/lib/admin-related-list";

import { adminKeys } from "./keys";

async function invalidateEvents(eventId?: string) {
  await queryClient.invalidateQueries({ queryKey: adminKeys.events.all });
  await queryClient.invalidateQueries({ queryKey: adminKeys.eventTiers.all });
  await queryClient.invalidateQueries({
    queryKey: adminKeys.eventInvitees.all,
  });
  await queryClient.invalidateQueries({ queryKey: adminKeys.inviteLinks.all });
  if (eventId) {
    await queryClient.invalidateQueries({
      queryKey: adminKeys.events.detail(eventId),
    });
  }
}

async function invalidateOrders(orderId?: string) {
  await queryClient.invalidateQueries({ queryKey: adminKeys.orders.all });
  await queryClient.invalidateQueries({ queryKey: adminKeys.orderTiers.all });
  await queryClient.invalidateQueries({ queryKey: adminKeys.admissions.all });
  await queryClient.invalidateQueries({
    queryKey: adminKeys.inviteRedemptions.all,
  });
  if (orderId) {
    await queryClient.invalidateQueries({
      queryKey: adminKeys.orders.detail(orderId),
    });
  }
}

async function invalidatePeople(personId?: string) {
  await queryClient.invalidateQueries({ queryKey: adminKeys.people.all });
  if (personId) {
    await queryClient.invalidateQueries({
      queryKey: adminKeys.people.detail(personId),
    });
  }
}

export const adminApi = {
  keys: adminKeys,
  events: {
    list: (pagination: { page: number; pageSize: number; sort: string }) =>
      queryOptions({
        queryKey: adminKeys.events.list(
          buildAdminListQueryKey(
            pagination.page,
            pagination.pageSize,
            undefined,
            pagination.sort,
          ),
        ),
        queryFn: () =>
          listEvents({
            ...pageToLimitSkip(pagination.page, pagination.pageSize),
            sort: pagination.sort,
          }),
      }),
  },
  event: {
    detail: (eventId: string) =>
      queryOptions({
        queryKey: adminKeys.events.detail(eventId),
        queryFn: () => getEvent(eventId),
        enabled: Boolean(eventId),
      }),
    tiers: (eventId: string) =>
      queryOptions({
        queryKey: adminKeys.eventTiers.list(relatedListParams({ eventId })),
        queryFn: () => listEventTiers(relatedListParams({ eventId })),
        enabled: Boolean(eventId),
      }),
    capacityUsage: (eventId: string) =>
      queryOptions({
        queryKey: adminKeys.orders.list(
          relatedListParams({
            eventId,
            status_in: "pending,paid",
          }),
        ),
        queryFn: async () => {
          const res = await listOrders(
            relatedListParams({
              eventId,
              status_in: "pending,paid",
            }),
          );

          return { used: res.meta.total };
        },
        enabled: Boolean(eventId),
      }),
    invitees: (
      eventId: string,
      pagination: {
        page: number;
        pageSize: number;
        sort: string;
        orderStatus?: string;
      },
    ) =>
      queryOptions({
        queryKey: [
          ...adminKeys.eventInvitees.list(
            buildAdminListQueryKey(
              pagination.page,
              pagination.pageSize,
              {
                eventId,
                ...(pagination.orderStatus
                  ? { orderStatus: pagination.orderStatus }
                  : {}),
              },
              pagination.sort,
            ),
          ),
          pagination.orderStatus,
        ],
        queryFn: () =>
          listEventInvitees({
            ...pageToLimitSkip(pagination.page, pagination.pageSize),
            eventId,
            sort: pagination.sort,
            ...(pagination.orderStatus
              ? { orderStatus: pagination.orderStatus }
              : {}),
          }),
        enabled: Boolean(eventId),
      }),
    inviteeDetail: (inviteeId: string) =>
      queryOptions({
        queryKey: adminKeys.eventInvitees.detail(inviteeId),
        queryFn: () => getEventInvitee(inviteeId),
        enabled: Boolean(inviteeId),
      }),
    create: () =>
      mutationOptions({
        mutationFn: createEvent,
        onSuccess: async () => {
          await invalidateEvents();
        },
      }),
    update: (eventId: string) =>
      mutationOptions({
        mutationFn: (payload: unknown) => patchEvent(eventId, payload),
        onSuccess: async () => {
          await invalidateEvents(eventId);
        },
        onError: (err) =>
          toast.error(getApiErrorMessage(err, "Failed to update event")),
      }),
    upsertInvitees: (eventId: string) =>
      mutationOptions({
        mutationFn: (invitees: InviteeUpsertPayload[]) =>
          upsertEventInvitees(eventId, invitees),
        onSuccess: async () => {
          await invalidateEvents(eventId);
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Import failed")),
      }),
    addInvitee: (eventId: string) =>
      mutationOptions({
        mutationFn: (invitee: InviteeUpsertPayload) =>
          addEventInvitee(eventId, invitee),
        onSuccess: async () => {
          await invalidateEvents(eventId);
        },
      }),
    updateInvitee: (eventId: string) =>
      mutationOptions({
        mutationFn: ({
          inviteeId,
          notes,
        }: {
          inviteeId: string;
          notes: string | null;
        }) => patchEventInvitee(inviteeId, { notes }),
        onSuccess: async () => {
          await invalidateEvents(eventId);
        },
        onError: (err) =>
          toast.error(getApiErrorMessage(err, "Failed to update invitee")),
      }),
    revokeInvitee: (eventId: string) =>
      mutationOptions({
        mutationFn: (inviteeId: string) =>
          revokeEventInvitee(eventId, inviteeId),
        onSuccess: async () => {
          await invalidateEvents(eventId);
        },
      }),
    ensureInviteeLink: (eventId: string) =>
      mutationOptions({
        mutationFn: (inviteeId: string) =>
          ensureInviteeLink(eventId, inviteeId),
        onSuccess: async () => {
          await invalidateEvents(eventId);
        },
        onError: (err) =>
          toast.error(getApiErrorMessage(err, "Failed to create link")),
      }),
    patchInviteLink: (eventId: string) =>
      mutationOptions({
        mutationFn: ({
          linkId,
          maxRedemptions,
        }: {
          linkId: string;
          maxRedemptions: number;
        }) => patchInviteLink(eventId, linkId, { maxRedemptions }),
        onSuccess: async () => {
          await invalidateEvents(eventId);
        },
        onError: (err) =>
          toast.error(getApiErrorMessage(err, "Failed to update cap")),
      }),
    deleteInviteLink: (eventId: string) =>
      mutationOptions({
        mutationFn: (linkId: string) => deleteInviteLink(eventId, linkId),
        onSuccess: async () => {
          await invalidateEvents(eventId);
        },
        onError: (err) =>
          toast.error(getApiErrorMessage(err, "Failed to delete link")),
      }),
    regenerateInviteeLink: (eventId: string) =>
      mutationOptions({
        mutationFn: ({
          inviteeId,
          maxRedemptions,
        }: {
          inviteeId: string;
          maxRedemptions?: number;
        }) =>
          regenerateInviteeLink(eventId, inviteeId, {
            ...(maxRedemptions != null ? { maxRedemptions } : {}),
          }),
        onSuccess: async () => {
          await invalidateEvents(eventId);
        },
        onError: (err) =>
          toast.error(getApiErrorMessage(err, "Failed to regenerate link")),
      }),
    putTiers: (eventId: string) =>
      mutationOptions({
        mutationFn: (payload: { tiers: Omit<TierRow, "id">[] }) =>
          putEventTiers(eventId, payload),
        onSuccess: async () => {
          await invalidateEvents(eventId);
        },
        onError: (err) =>
          toast.error(getApiErrorMessage(err, "Failed to save tiers")),
      }),
  },
  orders: {
    list: (pagination: { page: number; pageSize: number; sort: string }) =>
      queryOptions({
        queryKey: adminKeys.orders.list(
          buildAdminListQueryKey(
            pagination.page,
            pagination.pageSize,
            undefined,
            pagination.sort,
          ),
        ),
        queryFn: () =>
          listOrders({
            ...pageToLimitSkip(pagination.page, pagination.pageSize),
            sort: pagination.sort,
          }),
      }),
  },
  order: {
    detail: (orderId: string) =>
      queryOptions({
        queryKey: adminKeys.orders.detail(orderId),
        queryFn: () => getOrder(orderId),
        enabled: Boolean(orderId),
      }),
    person: (personId: string | undefined) =>
      queryOptions({
        queryKey: adminKeys.people.detail(personId ?? ""),
        queryFn: () => getPerson(personId!),
        enabled: Boolean(personId),
      }),
    event: (eventId: string | undefined) =>
      queryOptions({
        queryKey: adminKeys.events.detail(eventId ?? ""),
        queryFn: () => getEvent(eventId!),
        enabled: Boolean(eventId),
      }),
    tiers: (orderId: string) =>
      queryOptions({
        queryKey: adminKeys.orderTiers.list(relatedListParams({ orderId })),
        queryFn: () => listOrderTiers(relatedListParams({ orderId })),
        enabled: Boolean(orderId),
      }),
    eventTiersForOrder: (eventTierIds: string[]) =>
      queryOptions({
        queryKey: adminKeys.eventTiers.list(
          relatedListParams({
            id_in: toIdInParam(eventTierIds),
          }),
        ),
        queryFn: () =>
          listEventTiers(
            relatedListParams({
              id_in: toIdInParam(eventTierIds),
            }),
          ),
        enabled: eventTierIds.length > 0,
      }),
    admission: (orderId: string) =>
      queryOptions({
        queryKey: adminKeys.admissions.list(relatedListParams({ orderId })),
        queryFn: async () => {
          const res = await listAdmissions(relatedListParams({ orderId }));

          return res.items[0] ?? null;
        },
        enabled: Boolean(orderId),
      }),
    inviteRedemption: (orderId: string) =>
      queryOptions({
        queryKey: adminKeys.inviteRedemptions.list(
          relatedListParams({ orderId }),
        ),
        queryFn: async () => {
          const res = await listInviteRedemptions(
            relatedListParams({ orderId }),
          );

          return res.items[0] ?? null;
        },
        enabled: Boolean(orderId),
      }),
    refund: (boundOrderId?: string) =>
      mutationOptions({
        mutationFn: (id: string) => refundOrder(id),
        onSuccess: async (_data, id) => {
          await invalidateOrders(boundOrderId ?? id);
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Refund failed")),
      }),
    delete: (boundOrderId?: string) =>
      mutationOptions({
        mutationFn: (id: string) => deleteOrder(id),
        onSuccess: async () => {
          await invalidateOrders(boundOrderId);
        },
        onError: (err) => toast.error(getApiErrorMessage(err, "Delete failed")),
      }),
  },
  people: {
    list: (
      pagination: { page: number; pageSize: number; sort: string },
      search: string,
    ) =>
      queryOptions({
        queryKey: adminKeys.people.list(
          buildAdminListQueryKey(
            pagination.page,
            pagination.pageSize,
            { q: search },
            pagination.sort,
          ),
        ),
        queryFn: () =>
          listPeople({
            ...pageToLimitSkip(pagination.page, pagination.pageSize),
            sort: pagination.sort,
            ...(search ? { q: search } : {}),
          }),
      }),
    verify: () =>
      mutationOptions({
        mutationFn: verifyPeople,
        onSuccess: async () => {
          await invalidatePeople();
        },
        onError: (err) =>
          toast.error(getApiErrorMessage(err, "Verification failed")),
      }),
  },
  person: {
    detail: (personId: string) =>
      queryOptions({
        queryKey: adminKeys.people.detail(personId),
        queryFn: () => getPerson(personId),
        enabled: Boolean(personId),
      }),
    orders: (personId: string) =>
      queryOptions({
        queryKey: adminKeys.orders.list(
          relatedListParams({ personId, sort: "-createdAt" }),
        ),
        queryFn: () =>
          listOrders(relatedListParams({ personId, sort: "-createdAt" })),
        enabled: Boolean(personId),
      }),
    invitees: (personId: string) =>
      queryOptions({
        queryKey: adminKeys.eventInvitees.list(
          relatedListParams({ personId, sort: "-createdAt" }),
        ),
        queryFn: () =>
          listEventInvitees(
            relatedListParams({ personId, sort: "-createdAt" }),
          ),
        enabled: Boolean(personId),
      }),
    eventsByIds: (eventIds: string[]) =>
      queryOptions({
        queryKey: adminKeys.events.list(
          relatedListParams({ id_in: toIdInParam(eventIds) }),
        ),
        queryFn: () =>
          listEvents(relatedListParams({ id_in: toIdInParam(eventIds) })),
        enabled: eventIds.length > 0,
        select: (data) => new Map(data.items.map((event) => [event.id, event])),
      }),
    update: (personId: string) =>
      mutationOptions({
        mutationFn: (payload: unknown) => patchPerson(personId, payload),
        onSuccess: async () => {
          await invalidatePeople(personId);
        },
        onError: (err) =>
          toast.error(getApiErrorMessage(err, "Failed to update person")),
      }),
  },
  inviteLinks: {
    forHost: (eventId: string, inviterId: string | null | undefined) =>
      queryOptions({
        queryKey: [
          ...adminKeys.inviteLinks.list(
            relatedListParams({
              eventId,
              ...(inviterId ? { inviterId } : {}),
            }),
          ),
          inviterId ?? null,
        ],
        queryFn: async () => {
          const res = await listInviteLinks(
            relatedListParams({
              eventId,
              ...(inviterId ? { inviterId } : {}),
            }),
          );

          return res.items[0] ?? null;
        },
        enabled: Boolean(eventId && inviterId),
      }),
    usedRedemptions: (inviteLinkId: string | undefined) =>
      queryOptions({
        queryKey: adminKeys.orders.list(
          relatedListParams({
            inviteLinkId: inviteLinkId ?? "",
            status_in: "pending,paid",
          }),
        ),
        queryFn: async () => {
          const res = await listOrders(
            relatedListParams({
              inviteLinkId: inviteLinkId!,
              status_in: "pending,paid",
            }),
          );

          return res.meta.total;
        },
        enabled: Boolean(inviteLinkId),
      }),
  },
};
