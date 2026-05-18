import { publicSiteConfig } from "@/config/public-site";

const LOCAL_DEV_ORIGIN = "http://localhost:3000";

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

/**
 * Origin for public-site links copied from admin (invites, login).
 * Prefers `VITE_PUBLIC_SITE_URL`, then same-origin on production deploy, then config.
 */
export function resolvePublicSiteOrigin(): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined;

  if (fromEnv?.trim()) {
    return normalizeOrigin(fromEnv);
  }
  if (import.meta.env.DEV) {
    return LOCAL_DEV_ORIGIN;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return publicSiteConfig.url;
}

function publicSiteLocale(): string {
  const raw = import.meta.env.VITE_PUBLIC_SITE_DEFAULT_LOCALE as
    | string
    | undefined;

  return raw?.trim() || publicSiteConfig.defaultLocale;
}

/** Full public URL for an invite-only event host share link. */
export function buildPublicInviteUrl(
  slug: string,
  inviteToken: string,
): string {
  const origin = resolvePublicSiteOrigin();
  const locale = publicSiteLocale();
  const params = new URLSearchParams({
    slug,
    invite: inviteToken,
  });

  return `${origin}/${locale}/events/private?${params.toString()}`;
}

/** Email if present, otherwise E.164 phone (`+` prefix) for `?login=` prefill. */
export function personLoginContact(person: {
  email: string | null;
  phone: string | null;
}): string | null {
  const email = person.email?.trim();

  if (email) {
    return email;
  }
  const phone = person.phone?.trim();

  if (!phone) {
    return null;
  }

  return phone.startsWith("+") ? phone : `+${phone}`;
}

/** Public events index URL with prefilled login contact. */
export function buildPublicLoginUrl(loginContact: string): string {
  const origin = resolvePublicSiteOrigin();
  const locale = publicSiteLocale();
  const params = new URLSearchParams({ login: loginContact });

  return `${origin}/${locale}/events?${params.toString()}`;
}
