import { createAuthClient } from "better-auth/react";

const AUTH_PATH = "/admin/auth";

function resolveAuthBaseURL(): string {
  if (import.meta.env.DEV) return "";
  const root = import.meta.env.VITE_EVENTS_API_URL?.trim();
  if (!root) return "";
  return `${root.replace(/\/$/, "")}${AUTH_PATH}`;
}

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseURL(),
  basePath: AUTH_PATH,
});

export const { useSession, signIn, signOut } = authClient;
