import type { MiddlewareHandler } from "hono";

import { isNeonclubAdminEmail } from "../auth";
import { isAdminAuthDisabled } from "../../helpers/admin-auth-dev";
import type { AppEnv } from "../env";
import { authFactory } from "../factory";

type AuthVariableKey = keyof AppEnv["Variables"];

type AuthVariableValue<K extends AuthVariableKey> = NonNullable<AppEnv["Variables"][K]>;

function unauthorized(message: string): never {
  const err = new Error(message);
  (err as Error & { statusCode: number }).statusCode = 401;
  throw err;
}

export function requireAuth<K extends AuthVariableKey>(
  key: K,
  opts?: {
    predicate?: (value: AuthVariableValue<K>) => boolean;
    error?: string;
  },
): MiddlewareHandler<AppEnv> {
  return authFactory.createMiddleware(async (c, next) => {
    const value = c.var[key];
    if (value == null) {
      unauthorized(opts?.error ?? "Unauthorized.");
    }
    if (opts?.predicate && !opts.predicate(value as AuthVariableValue<K>)) {
      unauthorized(opts?.error ?? "Unauthorized.");
    }
    await next();
  });
}

export const requireParticipantPerson = requireAuth("participantSession", {
  predicate: (session) => session.personId != null,
  error: "Sign in to confirm your registration.",
});

export const requireAdminSession = authFactory.createMiddleware(async (c, next) => {
  if (isAdminAuthDisabled()) {
    await next();
    return;
  }
  const session = c.var.adminSession;
  if (!session?.user || !isNeonclubAdminEmail(session.user.email)) {
    unauthorized("Unauthorized.");
  }
  await next();
});
