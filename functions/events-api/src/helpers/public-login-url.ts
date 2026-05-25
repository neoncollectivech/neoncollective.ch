/**
 * Public login URL for CSV export and emails.
 * Keep in sync with apps/admin/src/lib/invite-url.ts (personLoginContact + buildPublicLoginUrl).
 */

import { getEventsApiEnv } from "../config/runtime-env";

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

export function publicSiteOrigin(): string {
  const raw = getEventsApiEnv().publicSiteUrl;

  return normalizeOrigin(raw.trim() || "http://localhost:3000");
}

export function publicSiteDefaultLocale(): string {
  return getEventsApiEnv().publicSiteDefaultLocale;
}

/** Email if present, otherwise E.164 phone (`+` prefix) for `?login=` prefill. */
export function resolveLoginContact(fields: {
  email: string | null;
  phoneE164: string | null;
}): string | null {
  const email = fields.email?.trim();

  if (email) {
    return email;
  }
  const phone = fields.phoneE164?.trim();

  if (!phone) {
    return null;
  }

  return phone.startsWith("+") ? phone : `+${phone}`;
}

/** Public events index URL with prefilled login contact. */
export function buildPublicLoginUrl(loginContact: string): string {
  const origin = publicSiteOrigin();
  const locale = publicSiteDefaultLocale();
  const params = new URLSearchParams({ login: loginContact });

  return `${origin}/${locale}/events?${params.toString()}`;
}
