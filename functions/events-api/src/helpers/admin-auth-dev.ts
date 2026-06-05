import { getEventsApiEnv } from "../config/runtime-env";
import { isNeonclubAdminEmail, type AuthSession } from "../auth/auth";

const DEFAULT_DEV_ADMIN_EMAIL = "dev@neonclub.ch";

/** Local dev only — never active in production (see runtime-env). */
export function isAdminAuthDisabled(): boolean {
  const env = getEventsApiEnv();
  if (env.nodeEnv === "production") {
    return false;
  }
  return env.adminAuthDisabled;
}

function resolveDevAdminEmail(): string {
  const email = (getEventsApiEnv().adminAuthDevEmail ?? DEFAULT_DEV_ADMIN_EMAIL).toLowerCase();
  if (!isNeonclubAdminEmail(email)) {
    throw new Error("ADMIN_AUTH_DEV_EMAIL must be a @neonclub.ch address when ADMIN_AUTH_DISABLED=1.");
  }
  return email;
}

/** Synthetic Better Auth session for dev bypass (not persisted). */
export function devAdminSession(): AuthSession {
  const email = resolveDevAdminEmail();
  const now = new Date();
  return {
    session: {
      id: "dev-admin-session",
      userId: "dev-admin-user",
      token: "dev-admin-token",
      expiresAt: new Date(now.getTime() + 86_400_000),
      createdAt: now,
      updatedAt: now,
    },
    user: {
      id: "dev-admin-user",
      email,
      emailVerified: true,
      name: "Dev Admin",
      createdAt: now,
      updatedAt: now,
    },
  };
}
