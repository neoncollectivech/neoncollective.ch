import { devAdminSession, isAdminAuthDisabled } from "../../helpers/admin-auth-dev";
import { extractEventApiKeyToken } from "../event-api-key-token";
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
  const token = extractEventApiKeyToken(c);
  if (token) {
    const auth = await resolveEventApiKey(token);
    if (auth) {
      c.set("eventApiKey", auth);
    }
  }
  await next();
});

export const loadAdminSession = authFactory.createMiddleware(async (c, next) => {
  if (isAdminAuthDisabled()) {
    c.set("adminSession", devAdminSession());
    await next();
    return;
  }
  const session = await resolveAdminSession(c);
  if (session) {
    c.set("adminSession", session);
  }
  await next();
});
