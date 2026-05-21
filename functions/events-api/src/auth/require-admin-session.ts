import type { MiddlewareHandler } from "hono";

import { auth, isNeonclubAdminEmail, type AuthSession } from "./auth";

export type AdminEnv = {
  Variables: {
    adminSession: AuthSession;
  };
};

export const requireAdminSession: MiddlewareHandler<AdminEnv> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user || !isNeonclubAdminEmail(session.user.email)) {
    return c.json({ error: "Unauthorized." }, 401);
  }
  c.set("adminSession", session);
  await next();
};
