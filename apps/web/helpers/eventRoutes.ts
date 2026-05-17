import type { Locale } from "@/i18n/config";

/**
 * Invite-only events are not pre-rendered under `/events/[slug]`. Use the client-only
 * `/events/private?slug=` route so `NEXT_PUBLIC_EVENT_SLUGS` can stay public-only.
 */
export function eventDetailPath(slug: string, inviteOnly: boolean): string {
  const enc = encodeURIComponent(slug);

  if (inviteOnly) {
    return `/events/private?slug=${enc}`;
  }

  return `/events/${enc}`;
}

export function eventDetailHref(
  locale: Locale,
  slug: string,
  inviteOnly: boolean,
): string {
  return `/${locale}${eventDetailPath(slug, inviteOnly)}`;
}
