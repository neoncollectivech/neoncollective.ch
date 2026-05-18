import { and, eq, gt, isNull } from "drizzle-orm";

import { normalizeEmailTypo, normalizeOptionalPhoneE164, phoneToStoredDigits } from "../contact.js";
import { getDb } from "../db/index.js";
import {
  participantSessions,
  people,
  profileVerificationCodes,
} from "../db/schema.js";
import { sendProfileVerificationEmail } from "../email.js";
import {
  e164FromStoredDigits,
  isEmailVerified,
  isPhoneVerified,
  isProfileComplete,
  pendingVerificationChannel,
  type PersonRow,
} from "../profile.js";
import { sha256Hex } from "../token.js";
import { REGISTRATION_EXCHANGE_TTL_MS } from "../registration-exchange-constants.js";
import { isSmsEnabled, sendRegistrationSmsCode } from "../sms.js";
import { isEmailEnabled } from "../email.js";
import { createLogger } from "@neon/server-kit";
import {
  materializePersonFromInvitee,
  MaterializeInviteeError,
  loadPublishedOrphanInviteeContact,
} from "./materialize-invitee-person.js";
import { ensurePersonInTx, syncEventInviteesToPerson } from "./people.js";
import {
  randomRegistrationExchangeCode,
  normalizeRegistrationExchangeCodeInput,
  type ParticipantSessionContext,
} from "./registration-session.js";

const log = createLogger("participant-profile");

export type ProfileMeResponse = {
  profileComplete: boolean;
  /** True when this session was started via a guest invite link. */
  inviteFlow: boolean;
  givenName: string;
  familyName: string;
  email: string | null;
  phoneE164: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  pendingVerification: "email" | "phone" | null;
};

function toProfileResponse(
  person: PersonRow | null,
  inviteFlow: boolean,
): ProfileMeResponse {
  if (!person) {
    return {
      profileComplete: false,
      inviteFlow,
      givenName: "",
      familyName: "",
      email: null,
      phoneE164: null,
      emailVerified: false,
      phoneVerified: false,
      pendingVerification: null,
    };
  }
  return {
    profileComplete: isProfileComplete(person),
    inviteFlow,
    givenName: person.givenName,
    familyName: person.familyName,
    email: person.email ?? null,
    phoneE164: e164FromStoredDigits(person.phone),
    emailVerified: isEmailVerified(person),
    phoneVerified: isPhoneVerified(person),
    pendingVerification: pendingVerificationChannel(person),
  };
}

async function loadPerson(personId: string): Promise<PersonRow | null> {
  const db = getDb();
  const [row] = await db
    .select({
      givenName: people.givenName,
      familyName: people.familyName,
      email: people.email,
      phone: people.phone,
      emailVerifiedAt: people.emailVerifiedAt,
      phoneVerifiedAt: people.phoneVerifiedAt,
    })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);
  return row ?? null;
}

function sessionInviteFlow(session: ParticipantSessionContext): boolean {
  return session.inviteLinkId != null;
}

function normalizedStoredEmail(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }
  return normalizeEmailTypo(raw.trim()).toLowerCase();
}

function profileFieldsUnchanged(
  existing: PersonRow,
  params: {
    givenName: string;
    familyName: string;
    email: string | null;
    phoneDigits: string | null;
  },
): boolean {
  return (
    existing.givenName === params.givenName &&
    existing.familyName === params.familyName &&
    normalizedStoredEmail(existing.email) === params.email &&
    (existing.phone ?? null) === params.phoneDigits
  );
}

function toProfileResponseFromEventInviteContact(
  contact: { email: string | null; phoneE164: string | null },
  inviteFlow: boolean,
): ProfileMeResponse {
  return {
    profileComplete: false,
    inviteFlow,
    givenName: "",
    familyName: "",
    email: contact.email,
    phoneE164: contact.phoneE164,
    emailVerified: false,
    phoneVerified: false,
    pendingVerification: contact.email ? "email" : contact.phoneE164 ? "phone" : null,
  };
}

export async function getParticipantProfile(
  session: ParticipantSessionContext,
): Promise<ProfileMeResponse> {
  const inviteFlow = sessionInviteFlow(session);
  if (session.personId) {
    const person = await loadPerson(session.personId);
    return toProfileResponse(person, inviteFlow);
  }
  if (session.eventInviteeId) {
    const contact = await loadPublishedOrphanInviteeContact(session.eventInviteeId);
    if (contact) {
      return toProfileResponseFromEventInviteContact(contact, inviteFlow);
    }
  }
  return toProfileResponse(null, inviteFlow);
}

export async function updateParticipantProfile(params: {
  session: ParticipantSessionContext;
  givenName: string;
  familyName: string;
  email: string | null;
  phoneE164: string | null;
}): Promise<
  | { ok: true; profile: ProfileMeResponse }
  | { ok: false; status: number; error: string }
> {
  const gn = params.givenName.trim();
  const fn = params.familyName.trim();
  if (!gn || !fn) {
    return { ok: false, status: 400, error: "Given name and family name are required." };
  }

  const em = params.email?.trim()
    ? normalizeEmailTypo(params.email.trim()).toLowerCase()
    : null;
  let phoneDigits: string | null = null;
  if (params.phoneE164?.trim()) {
    const e164 = normalizeOptionalPhoneE164(params.phoneE164);
    if (!e164) {
      return { ok: false, status: 400, error: "Invalid phone number." };
    }
    phoneDigits = phoneToStoredDigits(e164);
    if (!phoneDigits) {
      return { ok: false, status: 400, error: "Invalid phone number." };
    }
  }
  if (!em && !phoneDigits) {
    return {
      ok: false,
      status: 400,
      error: "Provide at least an email address or a phone number.",
    };
  }

  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      let personId = params.session.personId;
      if (personId) {
        const [existing] = await tx
          .select()
          .from(people)
          .where(eq(people.id, personId))
          .limit(1);
        if (!existing) {
          return { ok: false, status: 404, error: "Profile not found." };
        }
        if (
          profileFieldsUnchanged(existing, {
            givenName: gn,
            familyName: fn,
            email: em,
            phoneDigits,
          })
        ) {
          return {
            ok: true,
            profile: toProfileResponse(existing, sessionInviteFlow(params.session)),
          };
        }
        const emailChanged = normalizedStoredEmail(existing.email) !== em;
        const phoneChanged = (existing.phone ?? null) !== phoneDigits;
        try {
          personId = await ensurePersonInTx(tx, {
            givenName: gn,
            familyName: fn,
            email: em,
            phoneE164: phoneDigits ? `+${phoneDigits}` : null,
          });
        } catch (e) {
          if (e instanceof Error && e.message === "identity_conflict") {
            return {
              ok: false,
              status: 409,
              error: "These contact details belong to another profile.",
            };
          }
          throw e;
        }
        if (personId !== existing.id) {
          await tx
            .update(participantSessions)
            .set({ personId })
            .where(eq(participantSessions.id, params.session.sessionId));
        }
        const now = new Date();
        await tx
          .update(people)
          .set({
            emailVerifiedAt: emailChanged ? null : existing.emailVerifiedAt,
            phoneVerifiedAt: phoneChanged ? null : existing.phoneVerifiedAt,
            updatedAt: now,
          })
          .where(eq(people.id, personId));
      } else if (params.session.eventInviteeId) {
        try {
          personId = await materializePersonFromInvitee(
            params.session.eventInviteeId,
            { givenName: gn, familyName: fn },
            tx,
          );
          await syncEventInviteesToPerson(personId);
        } catch (e) {
          if (e instanceof MaterializeInviteeError) {
            if (e.code === "identity_conflict") {
              return {
                ok: false,
                status: 409,
                error: "These contact details belong to another profile.",
              };
            }
            if (e.code === "duplicate_contact") {
              return {
                ok: false,
                status: 409,
                error: "Email or phone is already in use.",
              };
            }
            return { ok: false, status: 404, error: e.message };
          }
          throw e;
        }
        await tx
          .update(participantSessions)
          .set({ personId })
          .where(eq(participantSessions.id, params.session.sessionId));
      } else {
        try {
          personId = await ensurePersonInTx(tx, {
            givenName: gn,
            familyName: fn,
            email: em,
            phoneE164: phoneDigits ? `+${phoneDigits}` : null,
          });
        } catch (e) {
          if (e instanceof Error && e.message === "identity_conflict") {
            return {
              ok: false,
              status: 409,
              error: "These contact details belong to another profile.",
            };
          }
          throw e;
        }
        await tx
          .update(participantSessions)
          .set({ personId })
          .where(eq(participantSessions.id, params.session.sessionId));
      }

      const person = await tx
        .select({
          givenName: people.givenName,
          familyName: people.familyName,
          email: people.email,
          phone: people.phone,
          emailVerifiedAt: people.emailVerifiedAt,
          phoneVerifiedAt: people.phoneVerifiedAt,
        })
        .from(people)
        .where(eq(people.id, personId!))
        .limit(1);
      return {
        ok: true,
        profile: toProfileResponse(person[0] ?? null, sessionInviteFlow(params.session)),
      };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Profile update failed.";
    log.error({ err: e }, msg);
    return { ok: false, status: 500, error: msg };
  }
}

function contactHashForChannel(
  channel: "email" | "phone",
  person: PersonRow,
): string | null {
  if (channel === "email") {
    const em = person.email?.trim();
    return em ? sha256Hex(em.toLowerCase()) : null;
  }
  const digits = person.phone?.trim();
  return digits ? sha256Hex(digits) : null;
}

export async function requestProfileVerification(params: {
  session: ParticipantSessionContext;
  channel: "email" | "phone";
  locale: "de" | "en" | "it";
}): Promise<
  | { ok: true; channel: "email" | "phone" }
  | { ok: false; status: number; error: string }
> {
  if (!params.session.personId) {
    return { ok: false, status: 400, error: "Save your profile details first." };
  }
  const person = await loadPerson(params.session.personId);
  if (!person) {
    return { ok: false, status: 404, error: "Profile not found." };
  }
  if (params.channel === "email" && !person.email?.trim()) {
    return { ok: false, status: 400, error: "No email on profile." };
  }
  if (params.channel === "phone" && !person.phone?.trim()) {
    return { ok: false, status: 400, error: "No phone on profile." };
  }
  if (params.channel === "email" && isEmailVerified(person)) {
    return { ok: false, status: 400, error: "Email is already verified." };
  }
  if (params.channel === "phone" && isPhoneVerified(person)) {
    return { ok: false, status: 400, error: "Phone is already verified." };
  }

  const contactHash = contactHashForChannel(params.channel, person);
  if (!contactHash) {
    return { ok: false, status: 400, error: "Invalid contact for verification." };
  }

  if (params.channel === "email" && !isEmailEnabled) {
    return {
      ok: false,
      status: 503,
      error:
        "Email is not configured. Set RESEND_API_KEY and FROM_EMAIL (address on a domain verified in Resend).",
    };
  }
  if (params.channel === "phone" && !isSmsEnabled()) {
    return {
      ok: false,
      status: 503,
      error: "SMS is not configured.",
    };
  }

  const rawCode = randomRegistrationExchangeCode();
  const codeHash = sha256Hex(rawCode);
  const expiresAt = new Date(Date.now() + REGISTRATION_EXCHANGE_TTL_MS);
  const db = getDb();

  await db.insert(profileVerificationCodes).values({
    sessionId: params.session.sessionId,
    codeHash,
    channel: params.channel,
    contactHash,
    expiresAt,
  });

  try {
    if (params.channel === "email") {
      await sendProfileVerificationEmail({
        to: person.email!,
        code: rawCode,
        locale: params.locale,
      });
    } else {
      const e164 = e164FromStoredDigits(person.phone);
      if (!e164) {
        throw new Error("Invalid phone on profile.");
      }
      const sms = await sendRegistrationSmsCode({
        toE164: e164,
        code: rawCode,
        accessUrl: "",
      });
      if (!sms.ok) {
        throw new Error(sms.error);
      }
    }
  } catch (e) {
    await db
      .delete(profileVerificationCodes)
      .where(eq(profileVerificationCodes.codeHash, codeHash));
    const msg = e instanceof Error ? e.message : "Could not send verification code.";
    log.error({ err: e, channel: params.channel }, msg);
    return { ok: false, status: 503, error: msg };
  }

  log.info({ sessionId: params.session.sessionId, channel: params.channel }, "Profile verification sent");
  return { ok: true, channel: params.channel };
}

export async function confirmProfileVerification(params: {
  session: ParticipantSessionContext;
  code: string;
}): Promise<
  | { ok: true; profile: ProfileMeResponse }
  | { ok: false; status: number; error: string }
> {
  if (!params.session.personId) {
    return { ok: false, status: 400, error: "Save your profile details first." };
  }

  const normalized = normalizeRegistrationExchangeCodeInput(params.code);
  if (!normalized) {
    return { ok: false, status: 400, error: "Invalid or expired code." };
  }
  const codeHash = sha256Hex(normalized);
  const db = getDb();

  return await db.transaction(async (tx) => {
    const [codeRow] = await tx
      .select()
      .from(profileVerificationCodes)
      .where(
        and(
          eq(profileVerificationCodes.codeHash, codeHash),
          eq(profileVerificationCodes.sessionId, params.session.sessionId),
          isNull(profileVerificationCodes.usedAt),
          gt(profileVerificationCodes.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!codeRow) {
      return { ok: false, status: 400, error: "Invalid or expired code." };
    }

    const [personRow] = await tx
      .select()
      .from(people)
      .where(eq(people.id, params.session.personId!))
      .limit(1);
    if (!personRow) {
      return { ok: false, status: 404, error: "Profile not found." };
    }

    const expectedHash = contactHashForChannel(codeRow.channel, personRow);
    if (!expectedHash || expectedHash !== codeRow.contactHash) {
      return { ok: false, status: 400, error: "Contact changed — request a new code." };
    }

    const now = new Date();
    await tx
      .update(profileVerificationCodes)
      .set({ usedAt: now })
      .where(eq(profileVerificationCodes.id, codeRow.id));

    if (codeRow.channel === "email") {
      await tx
        .update(people)
        .set({ emailVerifiedAt: now, updatedAt: now })
        .where(eq(people.id, personRow.id));
    } else {
      await tx
        .update(people)
        .set({ phoneVerifiedAt: now, updatedAt: now })
        .where(eq(people.id, personRow.id));
    }

    const [updated] = await tx
      .select({
        givenName: people.givenName,
        familyName: people.familyName,
        email: people.email,
        phone: people.phone,
        emailVerifiedAt: people.emailVerifiedAt,
        phoneVerifiedAt: people.phoneVerifiedAt,
      })
      .from(people)
      .where(eq(people.id, personRow.id))
      .limit(1);

    return {
      ok: true,
      profile: toProfileResponse(updated ?? null, sessionInviteFlow(params.session)),
    };
  });
}

export async function isSessionProfileComplete(
  session: ParticipantSessionContext,
): Promise<boolean> {
  if (!session.personId) {
    return false;
  }
  const person = await loadPerson(session.personId);
  return person ? isProfileComplete(person) : false;
}
