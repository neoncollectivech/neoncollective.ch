import type { Context } from "hono";

import { getAuth, isNeonclubAdminEmail, type AuthSession } from "../auth";

export type AdminSession = AuthSession;

export async function resolveAdminSession(c: Context): Promise<AdminSession | null> {
  const session = await getAuth().api.getSession({ headers: c.req.raw.headers });
  if (!session?.user || !isNeonclubAdminEmail(session.user.email)) {
    return null;
  }
  return session;
}
