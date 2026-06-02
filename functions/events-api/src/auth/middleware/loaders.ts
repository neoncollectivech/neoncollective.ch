import { authFactory } from "../factory";
import { resolveAdminSession } from "../resolvers/admin-session";
import { resolveEventApiKey } from "../resolvers/event-api-key";
import { resolveParticipantSession } from "../resolvers/participant-session";

export const loadParticipantSession = authFactory.createMiddleware(async (c, next) => {
  const session = await resolveParticipantSession(c);
  if (session) {
    c.set("participantSession", session);
  }
  await next();
});

export const loadEventApiKey = authFactory.createMiddleware(async (c, next) => {
  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    if (token) {
      const auth = await resolveEventApiKey(token);
      if (auth) {
        c.set("eventApiKey", auth);
      }
    }
  }
  await next();
});

export const loadAdminSession = authFactory.createMiddleware(async (c, next) => {
  const session = await resolveAdminSession(c);
  if (session) {
    c.set("adminSession", session);
  }
  await next();
});
