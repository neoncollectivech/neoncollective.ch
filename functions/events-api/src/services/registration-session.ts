import { randomBytes } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";

import { parseContactInput } from "../contact.js";
import { getDb } from "../db/index.js";
import { participantSessions, people, registrationExchangeCodes } from "../db/schema.js";
import { findInviteLinkByRawToken } from "./event-read.js";
import {
  isEmailEnabled,
  sendContributionConfirmationEmail,
  sendRegistrationAccessEmail,
} from "../email.js";
import { createLogger } from "@neon/server-kit";
import { isSmsEnabled, sendRegistrationSmsCode } from "../sms.js";
import { sha256Hex } from "../token.js";
import {
  REGISTRATION_CODE_ALPHABET,
  REGISTRATION_CODE_LENGTH,
  REGISTRATION_EXCHANGE_TTL_MS,
} from "../registration-exchange-constants.js";
import {
  personHasRegistrationEligibility,
  resolvePersonIdForRegistrationContact,
  syncRosterInviteesToPerson,
} from "./people.js";

const log = createLogger("registration-session");

const ALPHABET_LEN = REGISTRATION_CODE_ALPHABET.length;

export {
  REGISTRATION_CODE_ALPHABET,
  REGISTRATION_CODE_LENGTH,
  REGISTRATION_EXCHANGE_TTL_MS,
} from "../registration-exchange-constants.js";

function publicSiteOrigin(): string {
  const raw = process.env.PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3000";
  }
}

/** Absolute URL on the static site — blocks open redirects via tampered links. */
function validateParticipantReturnUrl(returnUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(returnUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return null;
  }
  if (u.origin !== publicSiteOrigin()) {
    return null;
  }
  return u.toString();
}

const COOKIE_NAME = "neon_ev_participant";

export function randomRegistrationExchangeCode(): string {
  const bytes = randomBytes(REGISTRATION_CODE_LENGTH);
  let s = "";
  for (let i = 0; i < REGISTRATION_CODE_LENGTH; i++) {
    s += REGISTRATION_CODE_ALPHABET[bytes[i]! % ALPHABET_LEN]!;
  }
  return s;
}

/** Appends `code` to an already-validated absolute return URL. */
export function appendCodeToReturnUrl(safeReturnUrl: string, rawCode: string): string {
  const u = new URL(safeReturnUrl);
  u.searchParams.set("code", rawCode);
  return u.toString();
}

export function normalizeRegistrationExchangeCodeInput(
  raw: string,
): string | null {
  const t = raw.trim().replace(/[\s-]+/g, "");
  if (t.length !== REGISTRATION_CODE_LENGTH) {
    return null;
  }
  const upper = t.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    if (!REGISTRATION_CODE_ALPHABET.includes(upper[i]!)) {
      return null;
    }
  }
  return upper;
}

/**
 * Inserts a one-time exchange row. Caller must delete by `codeHash` if a follow-up step
 * (e.g. SMS send) fails.
 */
export async function insertRegistrationExchangeCode(params: {
  personId: string;
  rawCode: string;
  channel: "email" | "phone";
}): Promise<{ codeHash: string }> {
  const codeHash = sha256Hex(params.rawCode);
  const expiresAt = new Date(Date.now() + REGISTRATION_EXCHANGE_TTL_MS);
  const db = getDb();
  await db.insert(registrationExchangeCodes).values({
    codeHash,
    personId: params.personId,
    channel: params.channel,
    expiresAt,
  });
  return { codeHash };
}

async function markRegistrationChannelVerified(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  personId: string,
  channel: "email" | "phone",
): Promise<void> {
  const [person] = await tx.select().from(people).where(eq(people.id, personId)).limit(1);
  if (!person) {
    return;
  }
  const now = new Date();
  if (channel === "email" && person.email?.trim()) {
    await tx
      .update(people)
      .set({
        emailVerifiedAt: person.emailVerifiedAt ?? now,
        updatedAt: now,
      })
      .where(eq(people.id, personId));
    return;
  }
  if (channel === "phone" && person.phone?.trim()) {
    await tx
      .update(people)
      .set({
        phoneVerifiedAt: person.phoneVerifiedAt ?? now,
        updatedAt: now,
      })
      .where(eq(people.id, personId));
  }
}

/** Path on the static site for an event dossier (public slug route vs client-only private route). */
function participantEventPathOnSite(params: {
  locale: string;
  eventSlug: string;
  accessMode: "public" | "invite_only";
}): string {
  const enc = encodeURIComponent(params.eventSlug);
  if (params.accessMode === "invite_only") {
    return `/${params.locale}/events/private?slug=${enc}`;
  }
  return `/${params.locale}/events/${enc}`;
}

/**
 * After a successful paid order, email the participant a static-site link with `?code=`
 * plus the code in the message body.
 */
export async function sendPostCheckoutParticipantAccessEmail(params: {
  personId: string;
  email: string;
  locale: "de" | "en" | "it";
  eventSlug: string;
  accessMode: "public" | "invite_only";
}): Promise<void> {
  if (!isEmailEnabled) {
    log.warn(
      { orderEmail: params.email },
      "Skipping post-checkout access email — Resend not configured",
    );
    return;
  }
  const site = process.env.PUBLIC_SITE_URL ?? "http://localhost:3000";
  let base: string;
  try {
    base = new URL(site).origin;
  } catch {
    base = "http://localhost:3000";
  }
  const rawCode = randomRegistrationExchangeCode();
  const { codeHash } = await insertRegistrationExchangeCode({
    personId: params.personId,
    rawCode,
    channel: "email",
  });
  const accessUrl = appendCodeToReturnUrl(
    new URL(
      participantEventPathOnSite({
        locale: params.locale,
        eventSlug: params.eventSlug,
        accessMode: params.accessMode,
      }),
      `${base}/`,
    ).toString(),
    rawCode,
  );
  try {
    await sendContributionConfirmationEmail({
      to: params.email,
      accessUrl,
      code: rawCode,
      locale: params.locale,
    });
  } catch (e) {
    const db = getDb();
    await db
      .delete(registrationExchangeCodes)
      .where(eq(registrationExchangeCodes.codeHash, codeHash));
    throw e;
  }
}

function sessionMaxAgeSec(): number {
  const raw = process.env.PARTICIPANT_SESSION_MAX_AGE_SEC;
  const n = raw ? parseInt(raw, 10) : 60 * 60 * 24 * 30;
  return Number.isFinite(n) && n > 0 ? n : 60 * 60 * 24 * 30;
}

/**
 * Participant session cookie for static site + separate API host.
 *
 * - `EVENT_SESSION_CROSS_SITE=0` / `false`: `SameSite=Lax` (rare: API and browser first-party
 *   match).
 * - Default: `SameSite=None; Secure` so cross-origin `fetch(..., { credentials })` keeps the
 *   session after refresh.
 */
export function resolveParticipantSessionCookieCrossSite(_params: {
  originHeader: string | undefined;
  requestUrl: string;
}): boolean {
  const raw = process.env.EVENT_SESSION_CROSS_SITE?.trim().toLowerCase();
  if (raw === "0" || raw === "false") {
    return false;
  }
  return true;
}

export function buildSessionCookieHeader(token: string, crossSite: boolean): string {
  const maxAge = sessionMaxAgeSec();
  if (crossSite) {
    return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; Secure; SameSite=None`;
  }
  const secure = process.env.NODE_ENV === "production" ? "Secure;" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; ${secure} SameSite=Lax`;
}

export function buildClearSessionCookieHeader(crossSite: boolean): string {
  if (crossSite) {
    return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; Secure; SameSite=None`;
  }
  const secure = process.env.NODE_ENV === "production" ? "Secure;" : "";
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; ${secure} SameSite=Lax`;
}

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

export type ParticipantIdentity = {
  personId: string;
  email: string | null;
  /** E.164 with leading + when derived from stored digits. */
  phoneE164: string | null;
  /** For UI greetings; empty when only a generic placeholder name is stored. */
  givenName: string;
  familyName: string;
};

export type ParticipantSessionContext = {
  sessionId: string;
  personId: string | null;
  inviteLinkId: string | null;
};

export type ResolvedParticipantSession = ParticipantSessionContext & {
  email: string | null;
  phoneE164: string | null;
  givenName: string;
  familyName: string;
};

function e164FromStoredDigits(digits: string | null): string | null {
  if (!digits?.trim()) {
    return null;
  }
  return `+${digits.replace(/\D/g, "")}`;
}

export async function requestRegistrationSession(params: {
  contact: string;
  locale: "de" | "en" | "it";
  returnUrl: string;
}): Promise<
  | { ok: true; channel: "email" | "sms" }
  | { ok: false; status: number; error: string }
> {
  const parsed = parseContactInput(params.contact);
  if (parsed.kind === "invalid") {
    return { ok: false, status: 400, error: parsed.reason };
  }

  const safeReturn = validateParticipantReturnUrl(params.returnUrl);
  if (!safeReturn) {
    return { ok: false, status: 400, error: "Invalid return URL." };
  }

  if (parsed.kind === "email") {
    if (!isEmailEnabled) {
      return {
        ok: false,
        status: 503,
        error:
          "Email is not configured. Set RESEND_API_KEY and FROM_EMAIL (address on a domain verified in Resend).",
      };
    }
    const email = parsed.email;
    const personId = await resolvePersonIdForRegistrationContact({
      kind: "email",
      email,
    });
    if (!personId) {
      return { ok: false, status: 404, error: "No registration found for this contact." };
    }
    await syncRosterInviteesToPerson(personId);
    if (!(await personHasRegistrationEligibility(personId))) {
      return { ok: false, status: 404, error: "No registration found for this contact." };
    }
    const rawCode = randomRegistrationExchangeCode();
    const { codeHash } = await insertRegistrationExchangeCode({
      personId,
      rawCode,
      channel: "email",
    });
    const accessUrl = appendCodeToReturnUrl(safeReturn, rawCode);
    try {
      await sendRegistrationAccessEmail({
        to: email,
        accessUrl,
        code: rawCode,
        locale: params.locale,
      });
    } catch (e) {
      const db = getDb();
      await db
        .delete(registrationExchangeCodes)
        .where(eq(registrationExchangeCodes.codeHash, codeHash));
      const msg = e instanceof Error ? e.message : "Email send failed.";
      log.error({ err: e, email }, msg);
      return { ok: false, status: 503, error: msg };
    }
    log.info({ email }, "Registration access email sent");
    return { ok: true, channel: "email" };
  }

  if (!isSmsEnabled()) {
    return {
      ok: false,
      status: 503,
      error:
        "SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM, and either TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET.",
    };
  }

  const phoneE164 = parsed.e164;
  const personId = await resolvePersonIdForRegistrationContact({
    kind: "phone",
    e164: phoneE164,
  });
  if (!personId) {
    return { ok: false, status: 404, error: "No registration found for this contact." };
  }
  await syncRosterInviteesToPerson(personId);
  if (!(await personHasRegistrationEligibility(personId))) {
    return { ok: false, status: 404, error: "No registration found for this contact." };
  }

  const rawCode = randomRegistrationExchangeCode();
  const { codeHash } = await insertRegistrationExchangeCode({
    personId,
    rawCode,
    channel: "phone",
  });
  const accessUrl = appendCodeToReturnUrl(safeReturn, rawCode);
  const sms = await sendRegistrationSmsCode({
    toE164: phoneE164,
    code: rawCode,
    accessUrl,
  });
  if (!sms.ok) {
    const db = getDb();
    await db
      .delete(registrationExchangeCodes)
      .where(eq(registrationExchangeCodes.codeHash, codeHash));
    return { ok: false, status: 503, error: sms.error };
  }
  log.info({ phoneE164 }, "Registration SMS code sent");
  return { ok: true, channel: "sms" };
}

export async function exchangeRegistrationCode(params: {
  code: string;
  /** When true, set `SameSite=None; Secure` so credentialed calls from the static site work. */
  crossSiteCookie: boolean;
}): Promise<
  | { ok: true; setCookie: string }
  | { ok: false; status: number; error: string }
> {
  const normalized = normalizeRegistrationExchangeCodeInput(params.code);
  if (!normalized) {
    return { ok: false, status: 400, error: "Invalid or expired code." };
  }
  const codeHash = sha256Hex(normalized);
  const db = getDb();
  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(registrationExchangeCodes)
      .where(
        and(
          eq(registrationExchangeCodes.codeHash, codeHash),
          isNull(registrationExchangeCodes.usedAt),
          gt(registrationExchangeCodes.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!row) {
      return { ok: false, status: 400, error: "Invalid or expired code." };
    }
    await tx
      .update(registrationExchangeCodes)
      .set({ usedAt: new Date() })
      .where(eq(registrationExchangeCodes.id, row.id));
    await markRegistrationChannelVerified(tx, row.personId, row.channel);
    const sessionToken = randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(sessionToken);
    const expiresAt = new Date(Date.now() + sessionMaxAgeSec() * 1000);
    await tx.insert(participantSessions).values({
      tokenHash,
      personId: row.personId,
      expiresAt,
    });
    return { ok: true, setCookie: buildSessionCookieHeader(sessionToken, params.crossSiteCookie) };
  });
}

function parseSessionCookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }
  const m = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!m?.[1]) {
    return null;
  }
  return decodeURIComponent(m[1].trim());
}

export async function resolveParticipantSessionFromCookie(
  cookieHeader: string | undefined,
): Promise<ResolvedParticipantSession | null> {
  const raw = parseSessionCookieToken(cookieHeader);
  if (!raw) {
    return null;
  }
  const tokenHash = sha256Hex(raw);
  const db = getDb();
  const [row] = await db
    .select({
      sessionId: participantSessions.id,
      personId: participantSessions.personId,
      inviteLinkId: participantSessions.inviteLinkId,
      email: people.email,
      phone: people.phone,
      givenName: people.givenName,
      familyName: people.familyName,
    })
    .from(participantSessions)
    .leftJoin(people, eq(people.id, participantSessions.personId))
    .where(
      and(
        eq(participantSessions.tokenHash, tokenHash),
        isNull(participantSessions.revokedAt),
        gt(participantSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) {
    return null;
  }
  return {
    sessionId: row.sessionId,
    personId: row.personId,
    inviteLinkId: row.inviteLinkId,
    email: row.email ?? null,
    phoneE164: e164FromStoredDigits(row.phone),
    givenName: row.givenName ? greetingDisplayName(row.givenName) : "",
    familyName: row.familyName ? greetingDisplayName(row.familyName) : "",
  };
}

/** Legacy shape for callers that require a linked person. */
export async function resolveParticipantIdentityFromCookie(
  cookieHeader: string | undefined,
): Promise<ParticipantIdentity | null> {
  const row = await resolveParticipantSessionFromCookie(cookieHeader);
  if (!row?.personId) {
    return null;
  }
  return {
    personId: row.personId,
    email: row.email,
    phoneE164: row.phoneE164,
    givenName: row.givenName,
    familyName: row.familyName,
  };
}

async function insertParticipantSession(params: {
  personId: string | null;
  inviteLinkId: string | null;
  crossSiteCookie: boolean;
}): Promise<{ setCookie: string; sessionId: string }> {
  const sessionToken = randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(sessionToken);
  const expiresAt = new Date(Date.now() + sessionMaxAgeSec() * 1000);
  const db = getDb();
  const [ins] = await db
    .insert(participantSessions)
    .values({
      tokenHash,
      personId: params.personId,
      inviteLinkId: params.inviteLinkId,
      expiresAt,
    })
    .returning({ id: participantSessions.id });
  return {
    setCookie: buildSessionCookieHeader(sessionToken, params.crossSiteCookie),
    sessionId: ins!.id,
  };
}

export async function createAnonymousParticipantSession(params: {
  inviteToken?: string | null;
  crossSiteCookie: boolean;
  cookieHeader: string | undefined;
}): Promise<
  | { ok: true; setCookie?: string; session: ParticipantSessionContext; created: boolean }
  | { ok: false; status: number; error: string }
> {
  const existing = await resolveParticipantSessionFromCookie(params.cookieHeader);
  if (existing) {
    let inviteLinkId = existing.inviteLinkId;
    if (params.inviteToken?.trim() && !inviteLinkId) {
      const guest = await findInviteLinkByRawToken(params.inviteToken.trim());
      if (guest) {
        if (guest.event.accessMode !== "invite_only") {
          return {
            ok: false,
            status: 400,
            error: "Invites are not used for public events.",
          };
        }
        inviteLinkId = guest.link.id;
        const db = getDb();
        await db
          .update(participantSessions)
          .set({ inviteLinkId })
          .where(eq(participantSessions.id, existing.sessionId));
      }
    }
    return {
      ok: true,
      session: {
        sessionId: existing.sessionId,
        personId: existing.personId,
        inviteLinkId: inviteLinkId ?? existing.inviteLinkId,
      },
      created: false,
    };
  }

  let inviteLinkId: string | null = null;
  if (params.inviteToken?.trim()) {
    const guest = await findInviteLinkByRawToken(params.inviteToken.trim());
    if (!guest) {
      return { ok: false, status: 400, error: "Invalid invite link." };
    }
    if (guest.event.accessMode !== "invite_only") {
      return {
        ok: false,
        status: 400,
        error: "Invites are not used for public events.",
      };
    }
    inviteLinkId = guest.link.id;
  }

  const { setCookie, sessionId } = await insertParticipantSession({
    personId: null,
    inviteLinkId,
    crossSiteCookie: params.crossSiteCookie,
  });
  return {
    ok: true,
    setCookie,
    session: { sessionId, personId: null, inviteLinkId },
    created: true,
  };
}
