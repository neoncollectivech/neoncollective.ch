/** Under `/admin/auth` so GCP/CDN routes match other admin paths (not `/api/auth`). */
const AUTH_PATH = "/admin/auth";

/** Public events-api root (Cloud Function URL, no trailing slash). */
function resolveEventsApiPublicUrl(publicUrl?: string): string {
  const root = (publicUrl ?? "http://localhost:8082").trim().replace(/\/$/, "");
  return root;
}

/** Public Better Auth base URL (`{EVENTS_API_PUBLIC_URL}/admin/auth`). */
export function resolveBetterAuthPublicUrl(publicUrl?: string): string {
  const root = resolveEventsApiPublicUrl(publicUrl);
  return root.endsWith(AUTH_PATH) ? root : `${root}${AUTH_PATH}`;
}

/** Rewrite to the public `/admin/auth/*` URL Better Auth routes on. */
export function toPublicAuthRequest(internal: Request, honoAuthPath: string, publicUrl?: string): Request {
  const pub = new URL(resolveBetterAuthPublicUrl(publicUrl));
  const suffix = honoAuthPath.replace(/^\/admin\/auth/, "") || "/";
  const query = new URL(internal.url).search;
  const publicUrlFull = `${pub.origin}${pub.pathname}${suffix}${query}`;
  return new Request(publicUrlFull, internal);
}
