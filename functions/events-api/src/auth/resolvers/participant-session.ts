import type { Context } from "hono";
import { getCookie } from "hono/cookie";

import { e164FromStoredDigits } from "../../helpers/profile";
import { sha256Hex } from "../../helpers/token";
import { peopleService } from "../../services/people.service";
import { participantSessionsService } from "../../services/participant-sessions.service";
import { loadPublishedOrphanInviteeContact } from "../../routes/registrations/invitee-orchestration";
import { PARTICIPANT_SESSION_COOKIE } from "../cookies/participant";

export type ParticipantSessionContext = {
  sessionId: string;
  personId: string | null;
  /** Parsed from session token when event-invite guest has not completed profile yet. */
  eventInviteeId: string | null;
  inviteLinkId: string | null;
};

export type ResolvedParticipantSession = ParticipantSessionContext & {
  email: string | null;
  phoneE164: string | null;
  givenName: string;
  familyName: string;
};

function greetingDisplayName(raw: string | null | undefined): string {
  const t = raw?.trim() ?? "";
  if (!t) {
    return "";
  }
  if (/^(guest|customer)$/i.test(t)) {
    return "";
  }
  return t;
}

function parseSessionCookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }
  const m = cookieHeader.match(new RegExp(`${PARTICIPANT_SESSION_COOKIE}=([^;]+)`));
  if (!m?.[1]) {
    return null;
  }
  return decodeURIComponent(m[1].trim());
}

/** Parses event-invite guest token shape `r.{inviteeId}.{hex}`. */
export function parseEventInviteeIdFromSessionToken(token: string): string | null {
  const m = /^r\.([0-9a-f-]{36})\.([0-9a-f]+)$/i.exec(token.trim());
  return m?.[1] ?? null;
}

export async function resolveParticipantSessionFromCookie(
  cookieHeader: string | undefined,
): Promise<ResolvedParticipantSession | null> {
  const raw = parseSessionCookieToken(cookieHeader);
  if (!raw) {
    return null;
  }
  const eventInviteeId = parseEventInviteeIdFromSessionToken(raw);
  const tokenHash = await sha256Hex(raw);
  const row = await participantSessionsService.findActiveByTokenHash(tokenHash);
  if (!row) {
    return null;
  }

  if (!row.personId && eventInviteeId) {
    const contact = await loadPublishedOrphanInviteeContact(eventInviteeId);
    if (!contact) {
      return null;
    }
    return {
      sessionId: row.sessionId,
      personId: null,
      eventInviteeId,
      inviteLinkId: row.inviteLinkId,
      email: contact.email,
      phoneE164: contact.phoneE164,
      givenName: "",
      familyName: "",
    };
  }

  if (!row.personId) {
    return {
      sessionId: row.sessionId,
      personId: null,
      eventInviteeId: null,
      inviteLinkId: row.inviteLinkId,
      email: null,
      phoneE164: null,
      givenName: "",
      familyName: "",
    };
  }
  const person = await peopleService.get(row.personId);
  if (!person) {
    return null;
  }
  return {
    sessionId: row.sessionId,
    personId: row.personId,
    eventInviteeId: null,
    inviteLinkId: row.inviteLinkId,
    email: person.email ?? null,
    phoneE164: e164FromStoredDigits(person.phone),
    givenName: person.givenName ? greetingDisplayName(person.givenName) : "",
    familyName: person.familyName ? greetingDisplayName(person.familyName) : "",
  };
}

export async function resolveParticipantSession(
  c: Context,
): Promise<ResolvedParticipantSession | null> {
  const cookieHeader = getCookie(c, PARTICIPANT_SESSION_COOKIE);
  if (cookieHeader) {
    return resolveParticipantSessionFromCookie(`${PARTICIPANT_SESSION_COOKIE}=${cookieHeader}`);
  }
  return resolveParticipantSessionFromCookie(c.req.header("Cookie"));
}
