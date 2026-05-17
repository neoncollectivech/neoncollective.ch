import { allowedCorsOriginsForSite } from "@neon/server-kit";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";

import { getDb } from "../db/index.js";
import * as authSchema from "../db/auth-schema.js";

const NEONCLUB_EMAIL_SUFFIX = "@neonclub.ch";

function adminTrustedOrigins(): string[] {
  const origins = new Set(allowedCorsOriginsForSite());
  const csv = process.env.ADMIN_ALLOWED_ORIGIN;
  if (csv?.trim()) {
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

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:8082",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: {
      user: authSchema.authUser,
      session: authSchema.authSession,
      account: authSchema.authAccount,
      verification: authSchema.authVerification,
    },
  }),
  trustedOrigins: adminTrustedOrigins(),
  advanced: {
    crossSubDomainCookies: {
      enabled: process.env.BETTER_AUTH_CROSS_SUBDOMAIN === "1",
      domain: process.env.BETTER_AUTH_COOKIE_DOMAIN,
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
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

export type AuthSession = typeof auth.$Infer.Session;

export function isNeonclubAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(NEONCLUB_EMAIL_SUFFIX));
}
