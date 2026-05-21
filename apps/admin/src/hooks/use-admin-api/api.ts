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
  canonicalizeIds,
  pageToLimitSkip,
} from "@/lib/admin-list";

import { adminKeys } from "./keys";

async function invalidateEvents(eventId?: string) {
  await queryClient.invalidateQueries({ queryKey: adminKeys.events.all });
  await queryClient.invalidateQueries({
    queryKey: adminKeys.eventInvitees.all,
  });
  if (eventId) {
    await queryClient.invalidateQueries({
      queryKey: adminKeys.events.detail(eventId),
    });
  }
}

async function invalidateOrders(orderId?: string) {
  await queryClient.invalidateQueries({ queryKey: adminKeys.orders.all });
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
    list: (pagination: { page: number; pageSize: number }) =>
      queryOptions({
        queryKey: adminKeys.events.list(
          buildAdminListQueryKey(pagination.page, pagination.pageSize),
        ),
        queryFn: () =>
          listEvents(pageToLimitSkip(pagination.page, pagination.pageSize)),
      }),
    byIds: (ids: string[]) => {
      const canonicalIds = canonicalizeIds(ids);
      const idIn = canonicalIds.join(",");

      return queryOptions({
        queryKey: adminKeys.events.byIds(idIn),
        queryFn: () => {
          const idCount = idIn ? idIn.split(",").length : 0;

          return listEvents({
            limit: String(idCount || 1),
            skip: "0",
            ...(idIn ? { id_in: idIn } : {}),
          });
        },
        enabled: Boolean(idIn),
        staleTime: 60_000,
        placeholderData: (previousData) => previousData,
        select: (data) => new Map(data.items.map((item) => [item.id, item])),
      });
    },
  },
  event: {
    detail: (eventId: string) =>
      queryOptions({
        queryKey: adminKeys.events.detail(eventId),
        queryFn: () => getEvent(eventId),
        enabled: Boolean(eventId),
      }),
    invitees: (
      eventId: string,
      pagination: { page: number; pageSize: number },
    ) =>
      queryOptions({
        queryKey: adminKeys.eventInvitees.list(
          buildAdminListQueryKey(pagination.page, pagination.pageSize, {
            eventId,
          }),
        ),
        queryFn: () =>
          listEventInvitees({
            ...pageToLimitSkip(pagination.page, pagination.pageSize),
            eventId,
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
    list: (pagination: { page: number; pageSize: number }) =>
      queryOptions({
        queryKey: adminKeys.orders.list(
          buildAdminListQueryKey(pagination.page, pagination.pageSize),
        ),
        queryFn: () =>
          listOrders(pageToLimitSkip(pagination.page, pagination.pageSize)),
      }),
  },
  order: {
    detail: (orderId: string) =>
      queryOptions({
        queryKey: adminKeys.orders.detail(orderId),
        queryFn: () => getOrder(orderId),
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
    list: (pagination: { page: number; pageSize: number }, search: string) =>
      queryOptions({
        queryKey: adminKeys.people.list(
          buildAdminListQueryKey(pagination.page, pagination.pageSize, {
            q: search,
          }),
        ),
        queryFn: () =>
          listPeople({
            ...pageToLimitSkip(pagination.page, pagination.pageSize),
            ...(search ? { q: search } : {}),
          }),
      }),
    byIds: (ids: string[]) => {
      const canonicalIds = canonicalizeIds(ids);
      const idIn = canonicalIds.join(",");

      return queryOptions({
        queryKey: adminKeys.people.byIds(idIn),
        queryFn: () => {
          const idCount = idIn ? idIn.split(",").length : 0;

          return listPeople({
            limit: String(idCount || 1),
            skip: "0",
            ...(idIn ? { id_in: idIn } : {}),
          });
        },
        enabled: Boolean(idIn),
        staleTime: 60_000,
        placeholderData: (previousData) => previousData,
        select: (data) => new Map(data.items.map((item) => [item.id, item])),
      });
    },
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
};
