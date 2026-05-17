import type { TierRow } from "@/lib/admin-types";
import type { InviteeUpsertPayload } from "@/lib/parse-invitees-csv";

import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  addEventInvitee,
  createEvent,
  ensureInviteeLink,
  getEvent,
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
  deleteOrder,
  refundOrder,
  regenerateInviteeLink,
  revokeEventInvitee,
  upsertEventInvitees,
  verifyPeople,
} from "@/lib/admin-api";
import { getApiErrorMessage } from "@/lib/api-error";
import { queryClient } from "@/lib/query-client";

import { adminKeys } from "./keys.js";

async function invalidateEvents(eventId?: string) {
  await queryClient.invalidateQueries({ queryKey: adminKeys.events.all });
  if (eventId) {
    await queryClient.invalidateQueries({
      queryKey: adminKeys.events.detail(eventId),
    });
    await queryClient.invalidateQueries({
      queryKey: adminKeys.events.invitees(eventId),
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
    list: () =>
      queryOptions({
        queryKey: adminKeys.events.list(),
        queryFn: listEvents,
      }),
  },
  event: {
    detail: (eventId: string) =>
      queryOptions({
        queryKey: adminKeys.events.detail(eventId),
        queryFn: () => getEvent(eventId),
        enabled: Boolean(eventId),
      }),
    invitees: (eventId: string) =>
      queryOptions({
        queryKey: adminKeys.events.invitees(eventId),
        queryFn: () => listEventInvitees(eventId),
        enabled: Boolean(eventId),
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
        }) => patchEventInvitee(eventId, inviteeId, { notes }),
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
    list: () =>
      queryOptions({
        queryKey: adminKeys.orders.list(),
        queryFn: listOrders,
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
    list: (search: string) =>
      queryOptions({
        queryKey: adminKeys.people.list({ q: search }),
        queryFn: () =>
          listPeople({
            ...(search ? { q: search } : {}),
            pageSize: "100",
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
