import type {
  EventDetail,
  InviteeRow,
  OrderDetail,
  PersonDetail,
  TierRow,
} from "@/lib/admin-types";
import type { InviteeUpsertPayload } from "@/lib/parse-invitees-csv";

import axios from "axios";

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
  eventId: string;
  personId: string;
  status: string;
  amountCents: number;
  locale: string;
  createdAt: string;
};

export type EventInviteeListRow = {
  id: string;
  eventId: string;
  personId: string | null;
  inviterId: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  revokedAt: string | null;
  createdAt: string;
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

export type AdminListRequestParams = {
  limit: string;
  skip: string;
  q?: string;
  eventId?: string;
  id_in?: string;
  personId_in?: string;
  sort?: string;
  /** Event invitees: `empty`, `has`, or latest order status (`pending`, `paid`, …). */
  orderStatus?: string;
};

export async function listEvents(params: AdminListRequestParams) {
  const res = await api.get<ListResponse<EventRow>>("/admin/events", {
    params,
  });

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

export async function listEventInvitees(params: AdminListRequestParams) {
  const res = await api.get<ListResponse<EventInviteeListRow>>(
    "/admin/event-invitees",
    { params },
  );

  return res.data;
}

export async function getEventInvitee(inviteeId: string) {
  const res = await api.get<ItemResponse<InviteeRow>>(
    `/admin/event-invitees/${inviteeId}`,
  );

  return res.data.item;
}

function filenameFromContentDisposition(
  header: string | undefined,
  fallback: string,
): string {
  if (!header) {
    return fallback;
  }
  const match = /filename="([^"]+)"/i.exec(header);

  return match?.[1]?.trim() || fallback;
}

export async function exportEventInviteesCsv(
  eventId: string,
  params: { orderStatus?: string; sort?: string },
): Promise<{ blob: Blob; filename: string }> {
  const fallbackFilename = "invitees.csv";

  try {
    const res = await api.get<Blob>(
      `/admin/events/${eventId}/invitees/export`,
      {
        params,
        responseType: "blob",
      },
    );

    return {
      blob: res.data,
      filename: filenameFromContentDisposition(
        res.headers["content-disposition"],
        fallbackFilename,
      ),
    };
  } catch (e) {
    if (!axios.isAxiosError(e) || !(e.response?.data instanceof Blob)) {
      throw e;
    }
    const text = await e.response.data.text();
    let message = "Export failed.";

    try {
      const body = JSON.parse(text) as { error?: string };

      if (body.error) {
        message = body.error;
      }
    } catch {
      /* non-JSON error body */
    }

    throw new Error(message);
  }
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
  inviteeId: string,
  payload: { notes: string | null },
) {
  await api.patch(`/admin/event-invitees/${inviteeId}`, payload);
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

export async function deleteInviteLink(eventId: string, linkId: string) {
  await api.delete(`/admin/events/${eventId}/invite-links/${linkId}`);
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

export async function listOrders(params: AdminListRequestParams) {
  const res = await api.get<ListResponse<OrderRow>>("/admin/orders", {
    params,
  });

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

export async function listPeople(params: AdminListRequestParams) {
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
