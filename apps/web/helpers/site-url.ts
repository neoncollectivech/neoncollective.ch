import { siteConfig } from "@/config/site";

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

/** Canonical site origin for absolute URLs (Stripe, magic links). */
export function getSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (fromEnv) {
    return normalizeOrigin(fromEnv);
  }

  return normalizeOrigin(siteConfig.url);
}

/** Absolute URL on this site (path must start with `/`). */
export function absoluteSiteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  return `${getSiteOrigin()}${normalized}`;
}

/**
 * Full-page navigation to an external host (e.g. Stripe Checkout).
 * Next router cannot leave the origin; this is the supported escape hatch.
 */
export function navigateExternally(url: string): void {
  window.location.assign(url);
}
