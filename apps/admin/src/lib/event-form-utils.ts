import type { EventDetail, EventFormValues } from "@/lib/admin-types";

import { pruneLocalizedText } from "@neon/site-locales";

export const emptyEventFormValues = (): EventFormValues => ({
  slug: "",
  title: "",
  summary: {},
  location: "",
  startsAt: "",
  accessMode: "public",
  eventQuota: "",
  defaultInviteLinkMaxRedemptions: "0",
});

export function eventToFormValues(event: EventDetail): EventFormValues {
  return {
    slug: event.slug,
    title: event.title,
    summary: event.summary ?? {},
    location: event.location ?? "",
    startsAt: event.startsAt ? toDatetimeLocal(event.startsAt) : "",
    accessMode: event.accessMode,
    eventQuota: event.eventQuota != null ? String(event.eventQuota) : "",
    defaultInviteLinkMaxRedemptions: String(
      event.defaultInviteLinkMaxRedemptions,
    ),
    status: event.status,
  };
}

export function formValuesToCreatePayload(values: EventFormValues) {
  return {
    slug: values.slug.trim(),
    title: values.title.trim(),
    summary: pruneLocalizedText(values.summary),
    location: values.location.trim() || null,
    startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : null,
    accessMode: values.accessMode,
    eventQuota: values.eventQuota.trim() ? Number(values.eventQuota) : null,
    defaultInviteLinkMaxRedemptions:
      Number(values.defaultInviteLinkMaxRedemptions) || 0,
  };
}

export function formValuesToUpdatePayload(values: EventFormValues) {
  const base = formValuesToCreatePayload(values);

  return {
    ...base,
    ...(values.status ? { status: values.status } : {}),
  };
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
