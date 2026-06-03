import type { EventDetail, PersonDetail, TierRow } from "@/lib/admin-types";
import type { InviteeUpsertPayload } from "@/lib/parse-invitees-csv";

import axios from "axios";

import { createAdminListClient } from "@/lib/admin-list-services/create-admin-list-client";
import { api, type ItemResponse, type ListResponse } from "@/lib/api-client";

/** Mirrors `eventsResourceMeta.project.list`. */
export type EventRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  accessMode: string;
  startsAt: string | null;
};

/** Mirrors `ordersResourceMeta.project.list`. */
export type OrderRow = {
  id: string;
  eventId: string;
  personId: string;
  status: string;
  amountCents: number;
  locale: string;
  createdAt: string;
};

/** Mirrors `eventInviteesResourceMeta.project.list`. */
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

/** Mirrors `peopleResourceMeta.project.list`. */
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

export type EventReadRow = EventDetail;

export type EventImageRow = {
  id: string;
  eventId: string;
  storageKey: string;
  url: string;
  contentType: string;
  byteSize: number;
  sortOrder: number;
  altText: string | null;
  focalX: number | null;
  focalY: number | null;
  createdAt: string;
};

export type EventSalesAnalyticsDay = {
  date: string;
  revenueCents: number;
  orderCount: number;
};

export type EventSalesAnalytics = {
  bucket: "day";
  series: EventSalesAnalyticsDay[];
  totals: {
    revenueCents: number;
    orderCount: number;
    avgOrderValueCents: number | null;
  };
};

export type OrderReadRow = OrderRow & {
  stripePaymentIntentId: string | null;
  inviteLinkId: string | null;
  promotionCodeId: string | null;
  updatedAt: string;
};

export type PromotionTierOverride = {
  eventTierId: string;
  priceCents: number;
};

/** Event-scoped promotion code from GET /admin/events/:id/promotion-codes. */
export type EventPromotionCodeRow = {
  id: string;
  eventId: string;
  code: string;
  kind: "percent_off" | "amount_off" | "tier_prices";
  percentBps: number | null;
  amountOffCents: number | null;
  tierOverrides: PromotionTierOverride[];
  maxRedemptions: number | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  usedRedemptions: number;
  remainingRedemptions: number | null;
};

export type PromotionCodeCreatePayload = {
  code: string;
  kind: "percent_off" | "amount_off" | "tier_prices";
  percentBps?: number;
  amountOffCents?: number;
  tierOverrides?: PromotionTierOverride[];
  maxRedemptions?: number | null;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type PromotionCodePatchPayload = {
  active?: boolean;
  maxRedemptions?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  tierOverrides?: PromotionTierOverride[];
  kind?: "percent_off" | "amount_off" | "tier_prices";
  percentBps?: number;
  amountOffCents?: number;
};

export type PersonReadRow = PersonDetail;

export type EventTierListRow = TierRow & {
  id: string;
  eventId: string;
  sold: number;
  placesRemaining: number | null;
};

export type OrderTierRow = {
  id: string;
  orderId: string;
  eventTierId: string;
  unitPriceCents: number;
};

export type AdmissionRow = {
  id: string;
  orderId: string;
  eventId: string;
  checkedInAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type InviteRedemptionRow = {
  id: string;
  orderId: string;
  inviteLinkId: string;
  createdAt: string;
};

export type InviteLinkRow = {
  id: string;
  eventId: string;
  inviterId: string | null;
  maxRedemptions: number;
  token: string;
  createdAt: string;
  rotatedAt: string | null;
};

export type AdminListRequestParams = {
  limit: string;
  skip: string;
  q?: string;
  eventId?: string;
  personId?: string;
  orderId?: string;
  inviterId?: string;
  inviteLinkId?: string;
  eventTierId?: string;
  id_in?: string;
  personId_in?: string;
  sort?: string;
  status_in?: string;
  /** Event invitees: `empty`, `has`, or latest order status (`pending`, `paid`, …). */
  orderStatus?: string;
};

// --- Resource CRUD (generated list/read/create/update via createResourceRouter) ---

const listEventsClient = createAdminListClient<EventRow>("/admin/events");
const listEventInviteesClient = createAdminListClient<EventInviteeListRow>(
  "/admin/event-invitees",
);
const listOrdersClient = createAdminListClient<OrderRow>("/admin/orders");
const listPeopleClient = createAdminListClient<PersonRow>("/admin/people");
const listEventTiersClient =
  createAdminListClient<EventTierListRow>("/admin/event-tiers");
const listOrderTiersClient =
  createAdminListClient<OrderTierRow>("/admin/order-tiers");
const listAdmissionsClient =
  createAdminListClient<AdmissionRow>("/admin/admissions");
const listInviteRedemptionsClient = createAdminListClient<InviteRedemptionRow>(
  "/admin/invite-redemptions",
);
const listInviteLinksClient = createAdminListClient<InviteLinkRow>(
  "/admin/invite-links",
);

export const listEvents = listEventsClient;

export async function getEvent(eventId: string) {
  const res = await api.get<ItemResponse<EventReadRow>>(
    `/admin/events/${eventId}`,
  );

  return res.data.item;
}

export async function createEvent(payload: unknown) {
  const res = await api.post<ItemResponse<EventReadRow>>(
    "/admin/events",
    payload,
  );

  return res.data.item;
}

export async function patchEvent(eventId: string, payload: unknown) {
  const res = await api.patch<ItemResponse<EventReadRow>>(
    `/admin/events/${eventId}`,
    payload,
  );

  return res.data.item;
}

export const listEventInvitees = listEventInviteesClient;

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

// --- Control actions (routes/admin/control + providers; not generated CRUD) ---

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

export async function deleteEventInvitee(eventId: string, inviteeId: string) {
  await api.delete(`/admin/events/${eventId}/invitees/${inviteeId}`);
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

export async function listEventImages(eventId: string) {
  const res = await api.get<{ images: EventImageRow[] }>(
    `/admin/events/${eventId}/images`,
  );

  return res.data.images;
}

export async function presignEventImage(
  eventId: string,
  payload: { filename: string; contentType: string; byteSize: number },
) {
  const res = await api.post<{
    uploadUrl: string;
    storageKey: string;
    url: string;
    contentType: string;
  }>(`/admin/events/${eventId}/images/presign`, payload);

  return res.data;
}

export async function createEventImage(
  eventId: string,
  payload: {
    storageKey: string;
    contentType: string;
    byteSize: number;
    altText?: string | null;
  },
) {
  const res = await api.post<EventImageRow>(
    `/admin/events/${eventId}/images`,
    payload,
  );

  return res.data;
}

export async function reorderEventImages(
  eventId: string,
  payload: { imageIds: string[] },
) {
  const res = await api.put<{ images: EventImageRow[] }>(
    `/admin/events/${eventId}/images/reorder`,
    payload,
  );

  return res.data.images;
}

export async function deleteEventImage(eventId: string, imageId: string) {
  await api.delete(`/admin/events/${eventId}/images/${imageId}`);
}

export async function patchEventImageFocal(
  eventId: string,
  imageId: string,
  payload: { focalX: number | null; focalY: number | null },
) {
  const res = await api.patch<EventImageRow>(
    `/admin/events/${eventId}/images/${imageId}`,
    payload,
  );

  return res.data;
}

export async function listEventPromotionCodes(eventId: string) {
  const res = await api.get<{ items: EventPromotionCodeRow[] }>(
    `/admin/events/${eventId}/promotion-codes`,
  );

  return res.data.items;
}

/** Client-side pagination over the event-scoped promotion codes list. */
export async function listEventPromotionCodesPaginated(
  eventId: string,
  params?: Pick<AdminListRequestParams, "limit" | "skip" | "sort">,
): Promise<ListResponse<EventPromotionCodeRow>> {
  const all = await listEventPromotionCodes(eventId);
  const limit = params?.limit ? Number.parseInt(params.limit, 10) : 50;
  const skip = params?.skip ? Number.parseInt(params.skip, 10) : 0;
  const sorted = sortEventPromotionCodeRows(all, params?.sort);

  return {
    items: sorted.slice(skip, skip + limit),
    meta: { total: sorted.length, limit, skip },
  };
}

function sortEventPromotionCodeRows(
  rows: EventPromotionCodeRow[],
  sort?: string,
): EventPromotionCodeRow[] {
  const [field, direction] = (sort ?? "createdAt:desc").split(":");
  const dir = direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const av = a[field as keyof EventPromotionCodeRow];
    const bv = b[field as keyof EventPromotionCodeRow];

    if (av == null && bv == null) {
      return 0;
    }
    if (av == null) {
      return 1;
    }
    if (bv == null) {
      return -1;
    }
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * dir;
    }

    return String(av).localeCompare(String(bv)) * dir;
  });
}

export async function getEventSalesAnalytics(eventId: string) {
  const res = await api.get<EventSalesAnalytics>(
    `/admin/events/${eventId}/sales-analytics`,
  );

  return res.data;
}

export async function createEventPromotionCode(
  eventId: string,
  payload: PromotionCodeCreatePayload,
) {
  const res = await api.post<{ item: EventPromotionCodeRow }>(
    `/admin/events/${eventId}/promotion-codes`,
    payload,
  );

  return res.data.item;
}

export async function patchEventPromotionCode(
  eventId: string,
  promotionCodeId: string,
  payload: PromotionCodePatchPayload,
) {
  const res = await api.patch<{ item: EventPromotionCodeRow }>(
    `/admin/events/${eventId}/promotion-codes/${promotionCodeId}`,
    payload,
  );

  return res.data.item;
}

export async function deletePromotionCode(promotionCodeId: string) {
  await api.delete(`/admin/promotion-codes/${promotionCodeId}`);
}

export async function getPromotionCode(promotionCodeId: string) {
  const res = await api.get<ItemResponse<EventPromotionCodeRow>>(
    `/admin/promotion-codes/${promotionCodeId}`,
  );

  return res.data.item;
}

export const listOrders = listOrdersClient;

export async function getOrder(orderId: string) {
  const res = await api.get<ItemResponse<OrderReadRow>>(
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

export const listPeople = listPeopleClient;

export type PersonCreatePayload = {
  givenName: string;
  familyName: string;
  email: string | null;
  phoneE164: string | null;
  markVerified?: boolean;
};

export async function createPerson(payload: PersonCreatePayload) {
  const res = await api.post<ItemResponse<PersonReadRow>>(
    "/admin/people/create",
    payload,
  );

  return res.data.item;
}

export async function getPerson(personId: string) {
  const res = await api.get<ItemResponse<PersonReadRow>>(
    `/admin/people/${personId}`,
  );

  return res.data.item;
}

export async function patchPerson(personId: string, payload: unknown) {
  const res = await api.patch<ItemResponse<PersonReadRow>>(
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

export type PersonLinkCounts = {
  orders: number;
  inviteesAsGuest: number;
  inviteesAsHost: number;
  inviteLinksAsHost: number;
};

export type PersonDeletionEligibility = {
  deletable: boolean;
  links: PersonLinkCounts;
};

export async function getPersonDeletionEligibility(personId: string) {
  const res = await api.get<ItemResponse<PersonDeletionEligibility>>(
    `/admin/people/${personId}/deletion-eligibility`,
  );

  return res.data.item;
}

export async function deletePerson(personId: string) {
  await api.delete(`/admin/people/${personId}`);
}

export const listEventTiers = listEventTiersClient;
export const listOrderTiers = listOrderTiersClient;
export const listAdmissions = listAdmissionsClient;
export const listInviteRedemptions = listInviteRedemptionsClient;
export const listInviteLinks = listInviteLinksClient;

export type MaintenanceCategoryPreview = {
  key: string;
  label: string;
  description: string;
  count: number;
};

export type MaintenancePreview = {
  categories: MaintenanceCategoryPreview[];
  totalRows: number;
};

export type MaintenanceCategoryResult = {
  key: string;
  label: string;
  description: string;
  deleted: number;
};

export type MaintenanceRunResult = {
  categories: MaintenanceCategoryResult[];
  totalDeleted: number;
};

export async function getMaintenancePreview(): Promise<MaintenancePreview> {
  const res = await api.get<MaintenancePreview>("/admin/maintenance");

  return res.data;
}

export async function runMaintenance(): Promise<MaintenanceRunResult> {
  const res = await api.post<MaintenanceRunResult>("/admin/maintenance");

  return res.data;
}

/** Admin API key list item (no token hash). */
export type ApiKeyRow = {
  id: string;
  eventId: string | null;
  label: string;
  keyPrefix: string;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdByEmail: string | null;
};

export type ApiKeyCreatePayload = {
  label: string;
  eventId?: string | null;
};

export type ApiKeyCreateResult = {
  item: ApiKeyRow;
  token: string;
};

export async function listApiKeys(params?: { eventId?: "global" | string }) {
  const res = await api.get<{ items: ApiKeyRow[] }>("/admin/api-keys", {
    params:
      params?.eventId === "global"
        ? { eventId: "global" }
        : params?.eventId
          ? { eventId: params.eventId }
          : undefined,
  });

  return res.data.items;
}

export async function listEventApiKeys(eventId: string) {
  const res = await api.get<{ items: ApiKeyRow[] }>(
    `/admin/events/${eventId}/api-keys`,
  );

  return res.data.items;
}

export async function createApiKey(payload: ApiKeyCreatePayload) {
  const res = await api.post<ApiKeyCreateResult>("/admin/api-keys", payload);

  return res.data;
}

export async function createEventApiKey(
  eventId: string,
  payload: Pick<ApiKeyCreatePayload, "label">,
) {
  const res = await api.post<ApiKeyCreateResult>(
    `/admin/events/${eventId}/api-keys`,
    payload,
  );

  return res.data;
}

export async function revokeApiKey(id: string) {
  await api.post(`/admin/api-keys/${id}/revoke`);
}

export async function rotateApiKey(id: string) {
  const res = await api.post<ApiKeyCreateResult>(
    `/admin/api-keys/${id}/rotate`,
  );

  return res.data;
}

export async function deleteApiKey(id: string) {
  await api.delete(`/admin/api-keys/${id}`);
}
