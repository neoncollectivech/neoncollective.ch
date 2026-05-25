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
  listEventTiers,
  listInviteLinks,
  listInviteRedemptions,
  listAdmissions,
  listOrderTiers,
  listOrders,
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
import { toIdInParam } from "@/lib/admin-list";
import {
  relatedListFirst,
  relatedListParams,
  relatedListTotal,
} from "@/lib/admin-related-list";

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
    eventTiersForOrder: (eventTierIds: string[], eventId: string | undefined) =>
      queryOptions({
        queryKey: adminKeys.eventTiers.list(
          relatedListParams({
            eventId,
            id_in: toIdInParam(eventTierIds),
          }),
        ),
        queryFn: () =>
          listEventTiers(
            relatedListParams({
              eventId,
              id_in: toIdInParam(eventTierIds),
            }),
          ),
        enabled: eventTierIds.length > 0 && Boolean(eventId),
      }),
    admission: (orderId: string) =>
      queryOptions({
        queryKey: adminKeys.admissions.list(relatedListParams({ orderId })),
        queryFn: () =>
          relatedListFirst(listAdmissions, relatedListParams({ orderId })),
        enabled: Boolean(orderId),
      }),
    inviteRedemption: (orderId: string) =>
      queryOptions({
        queryKey: adminKeys.inviteRedemptions.list(
          relatedListParams({ orderId }),
        ),
        queryFn: () =>
          relatedListFirst(
            listInviteRedemptions,
            relatedListParams({ orderId }),
          ),
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
        queryFn: () =>
          relatedListFirst(
            listInviteLinks,
            relatedListParams({
              eventId,
              ...(inviterId ? { inviterId } : {}),
            }),
          ),
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
        queryFn: () =>
          relatedListTotal(
            listOrders,
            relatedListParams({
              inviteLinkId: inviteLinkId!,
              status_in: "pending,paid",
            }),
          ),
        enabled: Boolean(inviteLinkId),
      }),
  },
};
