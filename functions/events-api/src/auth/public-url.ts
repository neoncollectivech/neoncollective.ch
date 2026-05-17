const AUTH_PATH = "/api/auth";

/** Public events-api root (Cloud Function URL, no trailing slash). */
export function resolveEventsApiPublicUrl(): string {
  return (process.env.EVENTS_API_PUBLIC_URL ?? "http://localhost:8082").trim().replace(/\/$/, "");
}

/** Public Better Auth base URL (`{EVENTS_API_PUBLIC_URL}/api/auth`). */
export function resolveBetterAuthPublicUrl(): string {
  const root = resolveEventsApiPublicUrl();
  return root.endsWith(AUTH_PATH) ? root : `${root}${AUTH_PATH}`;
}

/** Rewrite an internal `/api/auth/*` request to the public URL Better Auth routes on. */
export function toPublicAuthRequest(internal: Request): Request {
  const pub = new URL(resolveBetterAuthPublicUrl());
  const internalUrl = new URL(internal.url);
  const suffix = internalUrl.pathname.replace(/^\/api\/auth/, "") || "/";
  const publicUrl = `${pub.origin}${pub.pathname}${suffix}${internalUrl.search}`;
  return new Request(publicUrl, internal);
}
