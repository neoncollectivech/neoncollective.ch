import type { Context } from "hono";

import { isDatabaseConfigured } from "../../services/db";
import {
  resolveParticipantSessionFromCookie,
  type ResolvedParticipantSession,
} from "../registrations/session";

export function databaseUnavailableResponse(c: Context) {
  return c.json({ error: "Database not configured." }, 503);
}

export function requireDatabase(_c: Context): boolean {
  return isDatabaseConfigured();
}

export async function requireParticipantSession(
  c: Context,
): Promise<ResolvedParticipantSession | Response> {
  const session = await resolveParticipantSessionFromCookie(c.req.header("Cookie"));
  if (!session) {
    return c.json({ error: "Session required." }, 401);
  }
  return session;
}

export async function requireParticipantPersonId(
  c: Context,
): Promise<{ personId: string } | Response> {
  const session = await resolveParticipantSessionFromCookie(c.req.header("Cookie"));
  if (!session?.personId) {
    return c.json({ error: "Sign in to confirm your registration." }, 401);
  }
  return { personId: session.personId };
}
