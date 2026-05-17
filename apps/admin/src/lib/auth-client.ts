import { createAuthClient } from "better-auth/react";

/** Better Auth fetch base — must include `/api/auth` when the API URL has a path segment. */
function resolveAuthBaseURL(): string {
  if (import.meta.env.DEV) return "";
  const root = import.meta.env.VITE_EVENTS_API_URL?.trim();
  if (!root) return "";
  return `${root.replace(/\/$/, "")}/api/auth`;
}

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseURL(),
});

export const { useSession, signIn, signOut } = authClient;
