import { getStripeApiEnv } from "./config/runtime-env";

function publicSiteOrigin(): string {
  const raw = getStripeApiEnv().publicSiteUrl;
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3000";
  }
}

/** Absolute URL on the static site — blocks open redirects. */
export function validatePublicSiteReturnUrl(returnUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(returnUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return null;
  }
  if (u.origin !== publicSiteOrigin()) {
    return null;
  }
  return u.toString();
}
