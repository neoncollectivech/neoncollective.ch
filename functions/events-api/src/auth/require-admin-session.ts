import type { MiddlewareHandler } from "hono";

import { getAuth, isNeonclubAdminEmail, type AuthSession } from "./auth";

/** Better Auth session for an authenticated @neonclub.ch admin. */
export type AdminSession = AuthSession;

export type AdminEnv = {
  Variables: {
    adminSession: AdminSession;
  };
};

export const requireAdminSession: MiddlewareHandler<AdminEnv> = async (c, next) => {
  const session = await getAuth().api.getSession({ headers: c.req.raw.headers });
  if (!session?.user || !isNeonclubAdminEmail(session.user.email)) {
    return c.json({ error: "Unauthorized." }, 401);
  }
  c.set("adminSession", session);
  await next();
};
