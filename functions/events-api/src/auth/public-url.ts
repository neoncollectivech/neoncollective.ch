/** Under `/admin/auth` so GCP/CDN routes match other admin paths (not `/api/auth`). */
const AUTH_PATH = "/admin/auth";

/** Public events-api root (Cloud Function URL, no trailing slash). */
export function resolveEventsApiPublicUrl(): string {
  return (process.env.EVENTS_API_PUBLIC_URL ?? "http://localhost:8082").trim().replace(/\/$/, "");
}

/** Public Better Auth base URL (`{EVENTS_API_PUBLIC_URL}/admin/auth`). */
export function resolveBetterAuthPublicUrl(): string {
  const root = resolveEventsApiPublicUrl();
  return root.endsWith(AUTH_PATH) ? root : `${root}${AUTH_PATH}`;
}

/** Rewrite to the public `/admin/auth/*` URL Better Auth routes on. */
export function toPublicAuthRequest(internal: Request, honoAuthPath: string): Request {
  const pub = new URL(resolveBetterAuthPublicUrl());
  const suffix = honoAuthPath.replace(/^\/admin\/auth/, "") || "/";
  const query = new URL(internal.url).search;
  const publicUrl = `${pub.origin}${pub.pathname}${suffix}${query}`;
  return new Request(publicUrl, internal);
}
