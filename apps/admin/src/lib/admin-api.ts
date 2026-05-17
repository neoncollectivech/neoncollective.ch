import type {
  EventDetail,
  InviteeRow,
  OrderDetail,
  PersonDetail,
  TierRow,
} from "@/lib/admin-types";
import type { InviteeUpsertPayload } from "@/lib/parse-invitees-csv";

import { api, type ItemResponse, type ListResponse } from "@/lib/api-client";

export type EventRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  accessMode: string;
  startsAt: string | null;
};

export type OrderRow = {
  id: string;
  status: string;
  amountCents: number;
  person: { givenName: string; familyName: string; email: string | null };
  event: { id: string; title: string; slug: string };
};

export type PersonRow = {
  id: string;
  givenName: string;
  familyName: string;
  email: string | null;
  phone: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
};

export type InviteeUpsertMeta = {
  created: number;
  skipped: number;
  invalid: number;
};

export type InviteeUpsertResult = {
  status: "created" | "skipped";
};

export type VerifyPeopleMeta = {
  updated: number;
  skipped: number;
  notFound: number;
};

export async function listEvents() {
  const res = await api.get<ListResponse<EventRow>>("/admin/events");

  return res.data;
}

export async function getEvent(eventId: string) {
  const res = await api.get<ItemResponse<EventDetail>>(
    `/admin/events/${eventId}`,
  );

  return res.data.item;
}

export async function createEvent(payload: unknown) {
  const res = await api.post<ItemResponse<EventDetail>>(
    "/admin/events",
    payload,
  );

  return res.data.item;
}

export async function patchEvent(eventId: string, payload: unknown) {
  const res = await api.patch<ItemResponse<EventDetail>>(
    `/admin/events/${eventId}`,
    payload,
  );

  return res.data.item;
}

export async function listEventInvitees(eventId: string) {
  const res = await api.get<ListResponse<InviteeRow>>(
    `/admin/events/${eventId}/invitees`,
  );

  return res.data.items;
}

export async function upsertEventInvitees(
  eventId: string,
  invitees: InviteeUpsertPayload[],
) {
  const res = await api.post<{ meta: InviteeUpsertMeta }>(
    `/admin/events/${eventId}/invitees`,
    { invitees },
  );

  return res.data.meta;
}

export async function addEventInvitee(
  eventId: string,
  invitee: InviteeUpsertPayload,
) {
  const res = await api.post<{ results: InviteeUpsertResult[] }>(
    `/admin/events/${eventId}/invitees`,
    { invitees: [invitee] },
  );

  return res.data.results[0]?.status ?? "created";
}

export async function patchEventInvitee(
  eventId: string,
  inviteeId: string,
  payload: { notes: string | null },
) {
  await api.patch(`/admin/events/${eventId}/invitees/${inviteeId}`, payload);
}

export async function revokeEventInvitee(eventId: string, inviteeId: string) {
  await api.post(`/admin/events/${eventId}/invitees/${inviteeId}/revoke`);
}

export async function ensureInviteeLink(eventId: string, inviteeId: string) {
  const res = await api.post<{ inviteToken: string }>(
    `/admin/events/${eventId}/invitees/${inviteeId}/ensure-link`,
  );

  return res.data.inviteToken;
}

export async function patchInviteLink(
  eventId: string,
  linkId: string,
  payload: { maxRedemptions: number },
) {
  await api.patch(`/admin/events/${eventId}/invite-links/${linkId}`, payload);
}

export async function regenerateInviteeLink(
  eventId: string,
  inviteeId: string,
  body: { maxRedemptions?: number },
) {
  const res = await api.post<{ inviteToken: string }>(
    `/admin/events/${eventId}/invitees/${inviteeId}/regenerate-link`,
    body,
  );

  return res.data.inviteToken;
}

export async function putEventTiers(
  eventId: string,
  payload: { tiers: Omit<TierRow, "id">[] },
) {
  await api.put(`/admin/events/${eventId}/tiers`, payload);
}

export async function listOrders() {
  const res = await api.get<ListResponse<OrderRow>>("/admin/orders");

  return res.data;
}

export async function getOrder(orderId: string) {
  const res = await api.get<ItemResponse<OrderDetail>>(
    `/admin/orders/${orderId}`,
  );

  return res.data.item;
}

export async function refundOrder(orderId: string) {
  await api.post(`/admin/orders/${orderId}/refund`);
}

export async function deleteOrder(orderId: string) {
  await api.delete(`/admin/orders/${orderId}`);
}

export async function listPeople(params?: { q?: string; pageSize?: string }) {
  const res = await api.get<ListResponse<PersonRow>>("/admin/people", {
    params,
  });

  return res.data;
}

export async function getPerson(personId: string) {
  const res = await api.get<ItemResponse<PersonDetail>>(
    `/admin/people/${personId}`,
  );

  return res.data.item;
}

export async function patchPerson(personId: string, payload: unknown) {
  const res = await api.patch<ItemResponse<PersonDetail>>(
    `/admin/people/${personId}`,
    payload,
  );

  return res.data.item;
}

export async function verifyPeople(personIds: string[]) {
  const res = await api.post<{ meta: VerifyPeopleMeta }>(
    "/admin/people/verify",
    {
      personIds,
    },
  );

  return res.data.meta;
}
