import { randomHex } from "@neon/server-kit";

import {
  buildClearSessionCookieHeader,
  buildSessionCookieHeader,
} from "../../auth/cookies/participant";
import { peopleService } from "../../services/people.service";
import {
  parseEventInviteeIdFromSessionToken,
  resolveParticipantSessionFromCookie,
  type ParticipantSessionContext,
} from "../../auth/resolvers/participant-session";
import { getEventsApiEnv } from "../../config/runtime-env";
import { parseContactInput } from "../../helpers/contact";
import { runTransaction, type EntityTx } from "../../services/transaction";
import { participantSessionsService } from "../../services/participant-sessions.service";
import { profileVerificationCodesService } from "../../services/profile-verification-codes.service";
import { registrationExchangeCodesService } from "../../services/registration-exchange-codes.service";
import { findInviteLinkByRawToken } from "../shared/invite-links-orchestration";
import {
  isEmailEnabled,
  sendContributionConfirmationEmail,
  sendRegistrationAccessEmail,
} from "../../helpers/email";
import { createLogger } from "@neon/server-kit";
import { isSmsEnabled, sendRegistrationSmsCode } from "../../helpers/sms";
import { isE2eTestMode } from "../../helpers/e2e-test-mode";
import { sha256Hex } from "../../helpers/token";
import { REGISTRATION_EXCHANGE_TTL_MS } from "../../config/registration";
import {
  clearStaleOtpForCode,
  hashOtpCode,
  issueRawOtpCode,
  normalizeRegistrationExchangeCodeInput,
  randomRegistrationExchangeCode,
} from "../../helpers/otp";
import {
  findPublishedOrphanInviteeId,
  loadPublishedOrphanInviteeContact,
} from "./invitee-orchestration";
import {
  personHasRegistrationEligibility,
  resolvePersonIdForRegistrationContact,
  syncEventInviteesToPerson,
} from "./people-orchestration";

export type {
  ParticipantIdentity,
  ParticipantSessionContext,
  ResolvedParticipantSession,
} from "../../auth/resolvers/participant-session";

const log = createLogger("registration-session");

export type RequestRegistrationSessionFailureReason =
  | "invalid_contact"
  | "invalid_return_url"
  | "email_not_configured"
  | "registration_not_found"
  | "delivery_failed"
  | "sms_not_configured";

export type ExchangeRegistrationCodeFailureReason = "invalid_code";

export type CreateAnonymousSessionFailureReason =
  | "invalid_invite_link"
  | "invites_not_for_public";

type RegistrationFailure<R extends string> = {
  ok: false;
  reason: R;
  message?: string;
};

function registrationFail<R extends string>(
  reason: R,
  message?: string,
): RegistrationFailure<R> {
  return message ? { ok: false, reason, message } : { ok: false, reason };
}

type RegistrationTarget =
  | { kind: "person"; personId: string }
  | { kind: "event_invitee"; inviteeId: string };

async function resolveRegistrationTarget(
  contact: Parameters<typeof resolvePersonIdForRegistrationContact>[0],
): Promise<RegistrationTarget | undefined> {
  const personId = await resolvePersonIdForRegistrationContact(contact);
  if (personId) {
    await syncEventInviteesToPerson(personId);
    if (await personHasRegistrationEligibility(personId)) {
      return { kind: "person", personId };
    }
  }

  const inviteeId = await findPublishedOrphanInviteeId(contact);
  if (inviteeId) {
    return { kind: "event_invitee", inviteeId };
  }

  return undefined;
}

function publicSiteOrigin(): string {
  const raw = getEventsApiEnv().publicSiteUrl;
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

/** Appends `code` to an already-validated absolute return URL. */
export function appendCodeToReturnUrl(safeReturnUrl: string, rawCode: string): string {
  const u = new URL(safeReturnUrl);
  u.searchParams.set("code", rawCode);
  return u.toString();
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
  await clearStaleOtpForCode(params.rawCode);
  const codeHash = await hashOtpCode(params.rawCode);
  const expiresAt = new Date(Date.now() + REGISTRATION_EXCHANGE_TTL_MS);
  await registrationExchangeCodesService.insert({
    codeHash,
    personId: params.personId,
    channel: params.channel,
    expiresAt,
  });
  return { codeHash };
}

const EVENT_INVITE_PENDING_CONTACT_PREFIX = "event-invite-pending:";
/** Pre-rename verification hash prefix — still parsed for in-flight OTP rows. */
const LEGACY_PENDING_CONTACT_PREFIX = "roster-pending:";

function eventInvitePendingContactHash(inviteeId: string): string {
  return `${EVENT_INVITE_PENDING_CONTACT_PREFIX}${inviteeId}`;
}

export function parseEventInviteeIdFromContactHash(
  contactHash: string,
): string | null {
  for (const prefix of [
    EVENT_INVITE_PENDING_CONTACT_PREFIX,
    LEGACY_PENDING_CONTACT_PREFIX,
  ]) {
    if (!contactHash.startsWith(prefix)) {
      continue;
    }
    const id = contactHash.slice(prefix.length).trim();
    return id.length > 0 ? id : null;
  }
  return null;
}

/** Session cookie token for event-invite guests before a `people` row exists (no DB column). */
export function buildEventInvitePendingSessionToken(inviteeId: string): string {
  return `r.${inviteeId}.${randomHex(32)}`;
}

export { parseEventInviteeIdFromSessionToken };

/**
 * Event-invite guest sign-in before profile completion: session without `person_id`, OTP via
 * `profile_verification_codes` (reuses existing tables — no schema migration).
 */
async function insertEventInvitePendingSignInCode(params: {
  inviteeId: string;
  rawCode: string;
  channel: "email" | "phone";
}): Promise<{ codeHash: string; sessionId: string }> {
  await clearStaleOtpForCode(params.rawCode);
  const sessionToken = buildEventInvitePendingSessionToken(params.inviteeId);
  const tokenHash = await sha256Hex(sessionToken);
  const sessionExpiresAt = new Date(Date.now() + sessionMaxAgeSec() * 1000);
  const codeHash = await hashOtpCode(params.rawCode);
  const codeExpiresAt = new Date(Date.now() + REGISTRATION_EXCHANGE_TTL_MS);
  return runTransaction(async (tx) => {
    const sessionId = await participantSessionsService.insertInTx(tx, {
      tokenHash,
      personId: null,
      expiresAt: sessionExpiresAt,
    });
    await profileVerificationCodesService.insertInTx(tx, {
      sessionId,
      codeHash,
      channel: params.channel,
      contactHash: eventInvitePendingContactHash(params.inviteeId),
      expiresAt: codeExpiresAt,
    });
    return { codeHash, sessionId };
  });
}

async function markRegistrationChannelVerified(
  tx: EntityTx,
  personId: string,
  channel: "email" | "phone",
): Promise<void> {
  await peopleService.markChannelVerifiedInTx(tx, personId, channel);
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
  if (!isEmailEnabled()) {
    log.warn(
      { orderEmail: params.email },
      "Skipping post-checkout access email — Resend not configured",
    );
    return;
  }
  const site = getEventsApiEnv().publicSiteUrl;
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
    await registrationExchangeCodesService.deleteByCodeHash(codeHash);
    throw e;
  }
}

export function resolveParticipantSessionCookieCrossSite(_params: {
  originHeader: string | undefined;
  requestUrl: string;
}): boolean {
  return getEventsApiEnv().eventSessionCrossSite;
}

function sessionMaxAgeSec(): number {
  return getEventsApiEnv().participantSessionMaxAgeSec;
}

export { buildSessionCookieHeader, buildClearSessionCookieHeader, resolveParticipantSessionFromCookie };

export async function requestRegistrationSession(params: {
  contact: string;
  locale: "de" | "en" | "it";
  returnUrl: string;
}): Promise<
  | { ok: true; channel: "email" | "sms" }
  | RegistrationFailure<RequestRegistrationSessionFailureReason>
> {
  const parsed = parseContactInput(params.contact);
  if (parsed.kind === "invalid") {
    return registrationFail("invalid_contact", parsed.reason);
  }

  const safeReturn = validateParticipantReturnUrl(params.returnUrl);
  if (!safeReturn) {
    return registrationFail("invalid_return_url");
  }

  if (parsed.kind === "email") {
    if (!isE2eTestMode() && !isEmailEnabled()) {
      return registrationFail("email_not_configured");
    }
    const email = parsed.email;
    const target = await resolveRegistrationTarget({ kind: "email", email });
    if (!target) {
      return registrationFail("registration_not_found");
    }
    const rawCode = issueRawOtpCode();
    let codeHash: string;
    let pendingSessionId: string | undefined;
    if (target.kind === "person") {
      ({ codeHash } = await insertRegistrationExchangeCode({
        personId: target.personId,
        rawCode,
        channel: "email",
      }));
    } else {
      const pending = await insertEventInvitePendingSignInCode({
        inviteeId: target.inviteeId,
        rawCode,
        channel: "email",
      });
      codeHash = pending.codeHash;
      pendingSessionId = pending.sessionId;
    }
    const accessUrl = appendCodeToReturnUrl(safeReturn, rawCode);
    if (!isE2eTestMode()) {
      try {
        await sendRegistrationAccessEmail({
          to: email,
          accessUrl,
          code: rawCode,
          locale: params.locale,
        });
      } catch (e) {
        if (target.kind === "person") {
          await registrationExchangeCodesService.deleteByCodeHash(codeHash);
        } else {
          await profileVerificationCodesService.deleteByCodeHash(codeHash);
          if (pendingSessionId) {
            await participantSessionsService.deleteById(pendingSessionId);
          }
        }
        const msg = e instanceof Error ? e.message : "Email send failed.";
        log.error({ err: e, email }, msg);
        return registrationFail("delivery_failed", msg);
      }
      log.info({ email }, "Registration access email sent");
    } else {
      log.info({ email }, "Registration access code issued (E2E test mode, email not sent)");
    }
    return { ok: true, channel: "email" };
  }

  if (!isE2eTestMode() && !isSmsEnabled()) {
    return registrationFail("sms_not_configured");
  }

  const phoneE164 = parsed.e164;
  const target = await resolveRegistrationTarget({
    kind: "phone",
    e164: phoneE164,
  });
  if (!target) {
    return registrationFail("registration_not_found");
  }

  const rawCode = issueRawOtpCode();
  let codeHash: string;
  let pendingSessionId: string | undefined;
  if (target.kind === "person") {
    ({ codeHash } = await insertRegistrationExchangeCode({
      personId: target.personId,
      rawCode,
      channel: "phone",
    }));
  } else {
    const pending = await insertEventInvitePendingSignInCode({
      inviteeId: target.inviteeId,
      rawCode,
      channel: "phone",
    });
    codeHash = pending.codeHash;
    pendingSessionId = pending.sessionId;
  }
  const accessUrl = appendCodeToReturnUrl(safeReturn, rawCode);
  if (!isE2eTestMode()) {
    const sms = await sendRegistrationSmsCode({
      toE164: phoneE164,
      code: rawCode,
      accessUrl,
    });
    if (!sms.ok) {
      if (target.kind === "person") {
        await registrationExchangeCodesService.deleteByCodeHash(codeHash);
      } else {
        await profileVerificationCodesService.deleteByCodeHash(codeHash);
        if (pendingSessionId) {
          await participantSessionsService.deleteById(pendingSessionId);
        }
      }
      return registrationFail("delivery_failed", sms.error);
    }
    log.info({ phoneE164 }, "Registration SMS code sent");
  } else {
    log.info({ phoneE164 }, "Registration SMS code issued (E2E test mode, SMS not sent)");
  }
  return { ok: true, channel: "sms" };
}

export async function exchangeRegistrationCode(params: {
  code: string;
  /** When true, set `SameSite=None; Secure` so credentialed calls from the static site work. */
  crossSiteCookie: boolean;
}): Promise<
  | { ok: true; setCookie: string }
  | RegistrationFailure<ExchangeRegistrationCodeFailureReason>
> {
  const normalized = normalizeRegistrationExchangeCodeInput(params.code);
  if (!normalized) {
    return registrationFail("invalid_code");
  }
  const codeHash = await hashOtpCode(normalized);
  return await runTransaction(async (tx) => {
    const row = await registrationExchangeCodesService.findValidByCodeHash(codeHash, tx);
    if (row) {
      await registrationExchangeCodesService.markUsedInTx(tx, row.id);
      await markRegistrationChannelVerified(tx, row.personId, row.channel);
      const sessionToken = randomHex(32);
      const tokenHash = await sha256Hex(sessionToken);
      const expiresAt = new Date(Date.now() + sessionMaxAgeSec() * 1000);
      await participantSessionsService.insertInTx(tx, {
        tokenHash,
        personId: row.personId,
        expiresAt,
      });
      return {
        ok: true,
        setCookie: buildSessionCookieHeader(sessionToken, params.crossSiteCookie),
      };
    }

    const pendingRow = await profileVerificationCodesService.findValid(codeHash, undefined, tx);
    if (!pendingRow) {
      return registrationFail("invalid_code");
    }

    const inviteeId = parseEventInviteeIdFromContactHash(pendingRow.contactHash);
    if (!inviteeId) {
      return registrationFail("invalid_code");
    }
    const contact = await loadPublishedOrphanInviteeContact(inviteeId);
    if (!contact) {
      return registrationFail("invalid_code");
    }

    await profileVerificationCodesService.markUsedInTx(tx, pendingRow.id);

    const sessionToken = buildEventInvitePendingSessionToken(inviteeId);
    const tokenHash = await sha256Hex(sessionToken);
    const expiresAt = new Date(Date.now() + sessionMaxAgeSec() * 1000);
    await participantSessionsService.updateTokenHashAndExpiryInTx(
      tx,
      pendingRow.sessionId,
      tokenHash,
      expiresAt,
    );

    return {
      ok: true,
      setCookie: buildSessionCookieHeader(sessionToken, params.crossSiteCookie),
    };
  });
}

async function insertParticipantSession(params: {
  personId: string | null;
  inviteLinkId: string | null;
  crossSiteCookie: boolean;
}): Promise<{ setCookie: string; sessionId: string }> {
  const sessionToken = randomHex(32);
  const tokenHash = await sha256Hex(sessionToken);
  const expiresAt = new Date(Date.now() + sessionMaxAgeSec() * 1000);
  const sessionId = await runTransaction((tx) =>
    participantSessionsService.insertInTx(tx, {
      tokenHash,
      personId: params.personId,
      inviteLinkId: params.inviteLinkId,
      expiresAt,
    }),
  );
  return {
    setCookie: buildSessionCookieHeader(sessionToken, params.crossSiteCookie),
    sessionId,
  };
}

export async function createAnonymousParticipantSession(params: {
  inviteToken?: string | null;
  crossSiteCookie: boolean;
  cookieHeader: string | undefined;
}): Promise<
  | { ok: true; setCookie?: string; session: ParticipantSessionContext; created: boolean }
  | RegistrationFailure<CreateAnonymousSessionFailureReason>
> {
  const existing = await resolveParticipantSessionFromCookie(params.cookieHeader);
  if (existing) {
    let inviteLinkId = existing.inviteLinkId;
    if (params.inviteToken?.trim() && !inviteLinkId) {
      const guest = await findInviteLinkByRawToken(params.inviteToken.trim());
      if (guest) {
        if (guest.event.accessMode !== "invite_only") {
          return registrationFail("invites_not_for_public");
        }
        inviteLinkId = guest.link.id;
        await runTransaction((tx) =>
          participantSessionsService.updateInviteLinkIdInTx(tx, existing.sessionId, inviteLinkId),
        );
      }
    }
    return {
      ok: true,
      session: {
        sessionId: existing.sessionId,
        personId: existing.personId,
        eventInviteeId: existing.eventInviteeId,
        inviteLinkId: inviteLinkId ?? existing.inviteLinkId,
      },
      created: false,
    };
  }

  let inviteLinkId: string | null = null;
  if (params.inviteToken?.trim()) {
    const guest = await findInviteLinkByRawToken(params.inviteToken.trim());
    if (!guest) {
      return registrationFail("invalid_invite_link");
    }
    if (guest.event.accessMode !== "invite_only") {
      return registrationFail("invites_not_for_public");
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
    session: { sessionId, personId: null, eventInviteeId: null, inviteLinkId },
    created: true,
  };
}
