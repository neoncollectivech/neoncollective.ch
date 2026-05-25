import { allowedCorsOriginsForSite } from "@neon/server-kit";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";

import type { EventsApiEnv } from "../config/runtime-env";
import { getDb } from "../db/index";
import * as authSchema from "../db/auth-schema";
import { resolveBetterAuthPublicUrl } from "./public-url";

const NEONCLUB_EMAIL_SUFFIX = "@neonclub.ch";

function adminTrustedOrigins(env: EventsApiEnv): string[] {
  const origins = new Set(allowedCorsOriginsForSite());
  const csv = env.adminAllowedOrigin;
  if (csv) {
    for (const part of csv.split(",")) {
      const t = part.trim();
      if (t) {
        try {
          origins.add(new URL(t).origin);
        } catch {
          // ignore invalid
        }
      }
    }
  }
  origins.add("http://localhost:5173");
  origins.add("http://127.0.0.1:5173");
  return [...origins];
}

export function createAuth(env: EventsApiEnv) {
  return betterAuth({
    baseURL: resolveBetterAuthPublicUrl(env.eventsApiPublicUrl),
    secret: env.betterAuthSecret,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: authSchema.authUser,
        session: authSchema.authSession,
        account: authSchema.authAccount,
        verification: authSchema.authVerification,
      },
    }),
    trustedOrigins: adminTrustedOrigins(env),
    advanced: {
      crossSubDomainCookies: {
        enabled: env.betterAuthCrossSubdomain,
        domain: env.betterAuthCookieDomain,
      },
    },
    socialProviders: {
      google: {
        clientId: env.googleClientId,
        clientSecret: env.googleClientSecret,
        prompt: "select_account",
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const email = user.email?.toLowerCase() ?? "";
            if (!email.endsWith(NEONCLUB_EMAIL_SUFFIX)) {
              throw new APIError("FORBIDDEN", {
                message: "Only @neonclub.ch accounts are allowed.",
              });
            }
          },
        },
      },
    },
  });
}

export type BetterAuthInstance = ReturnType<typeof createAuth>;
export type AuthSession = BetterAuthInstance["$Infer"]["Session"];

export function isNeonclubAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(NEONCLUB_EMAIL_SUFFIX));
}

let authInstance: BetterAuthInstance | null = null;

export function configureAuth(auth: BetterAuthInstance): void {
  authInstance = auth;
}

export function getAuth(): BetterAuthInstance {
  if (!authInstance) {
    throw new Error("Better Auth is not configured — call configureAuth from app.ts");
  }
  return authInstance;
}
