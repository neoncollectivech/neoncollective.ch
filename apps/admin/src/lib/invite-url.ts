const DEFAULT_LOCALE = "en";

function publicSiteOrigin(): string {
  const raw = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined;
  if (!raw?.trim()) {
    return "http://localhost:3000";
  }
  return raw.replace(/\/$/, "");
}

function publicSiteLocale(): string {
  const raw = import.meta.env.VITE_PUBLIC_SITE_DEFAULT_LOCALE as string | undefined;
  return raw?.trim() || DEFAULT_LOCALE;
}

/** Full public URL for an invite-only event host share link. */
export function buildPublicInviteUrl(slug: string, inviteToken: string): string {
  const origin = publicSiteOrigin();
  const locale = publicSiteLocale();
  const params = new URLSearchParams({
    slug,
    invite: inviteToken,
  });
  return `${origin}/${locale}/events/private?${params.toString()}`;
}
