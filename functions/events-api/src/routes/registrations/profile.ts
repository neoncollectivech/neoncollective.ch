import { isE2eTestMode } from "../../helpers/e2e-test-mode";
import { runTransaction } from "../../services/transaction";
import { participantSessionsService } from "../../services/participant-sessions.service";
import { profileVerificationCodesService } from "../../services/profile-verification-codes.service";
import { sendProfileVerificationEmail } from "../../helpers/email";
import { isEmailEnabled } from "../../helpers/email";
import {
  e164FromStoredDigits,
  isEmailVerified,
  isPhoneVerified,
  isProfileComplete,
  normalizeStoredEmail,
  pendingVerificationChannel,
  profileContactFieldsMatch,
  toPersonRow,
  type PersonRow,
} from "../../helpers/profile";
import { sha256Hex } from "../../helpers/token";
import { REGISTRATION_EXCHANGE_TTL_MS } from "../../config/registration";
import {
  clearStaleOtpForCode,
  hashOtpCode,
  issueRawOtpCode,
  normalizeRegistrationExchangeCodeInput,
} from "../../helpers/otp";
import { isSmsEnabled, sendRegistrationSmsCode } from "../../helpers/sms";
import { createLogger } from "@neon/server-kit";
import {
  MaterializeInviteeError,
  materializePersonFromInvitee,
} from "../admin/providers/invitees-admin";
import { IdentityConflictError, peopleService } from "../../services/people.service";
import { loadPublishedOrphanInviteeContact } from "./invitee-orchestration";
import { syncEventInviteesToPerson } from "./people-orchestration";
import type { ParticipantSessionContext } from "./session";

const log = createLogger("participant-profile");

export type UpdateParticipantProfileFailureReason =
  | "names_required"
  | "invalid_contact"
  | "profile_not_found"
  | "identity_conflict"
  | "duplicate_contact"
  | "invitee_not_found"
  | "profile_update_failed";

export type RequestProfileVerificationFailureReason =
  | "profile_incomplete"
  | "profile_not_found"
  | "no_email"
  | "no_phone"
  | "email_verified"
  | "phone_verified"
  | "invalid_contact"
  | "email_not_configured"
  | "sms_not_configured"
  | "delivery_failed";

export type ConfirmProfileVerificationFailureReason =
  | "profile_incomplete"
  | "invalid_code"
  | "profile_not_found"
  | "contact_changed";

type ProfileFailure<R extends string> = {
  ok: false;
  reason: R;
  message?: string;
};

function profileFail<R extends string>(reason: R, message?: string): ProfileFailure<R> {
  return message ? { ok: false, reason, message } : { ok: false, reason };
}

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

function sessionInviteFlow(session: ParticipantSessionContext): boolean {
  return session.inviteLinkId != null;
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

export async function getParticipantProfile(
  session: ParticipantSessionContext,
): Promise<ProfileMeResponse> {
  const inviteFlow = sessionInviteFlow(session);
  if (session.personId) {
    const person = await peopleService.getProfileRow(session.personId);
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
  | ProfileFailure<UpdateParticipantProfileFailureReason>
> {
  const gn = params.givenName.trim();
  const fn = params.familyName.trim();
  if (!gn || !fn) {
    return profileFail("names_required");
  }

  const contact = peopleService.parseProfileContactInput({
    email: params.email,
    phoneE164: params.phoneE164,
  });
  if ("error" in contact) {
    return profileFail("invalid_contact", contact.error);
  }

  const inviteFlow = sessionInviteFlow(params.session);
  try {
    return await runTransaction(async (tx) => {
      let personId = params.session.personId;
      if (personId) {
        const existing = await peopleService.getInTx(tx, personId);
        if (!existing) {
          return profileFail("profile_not_found");
        }
        const existingProfile = toPersonRow(existing)!;
        if (
          profileContactFieldsMatch(existingProfile, {
            givenName: gn,
            familyName: fn,
            ...contact,
          })
        ) {
          return { ok: true, profile: toProfileResponse(existingProfile, inviteFlow) };
        }
        const emailChanged = normalizeStoredEmail(existing.email) !== contact.email;
        const phoneChanged = (existing.phone ?? null) !== contact.phoneDigits;
        try {
          personId = await peopleService.ensurePersonInTx(tx, {
            givenName: gn,
            familyName: fn,
            email: contact.email,
            phoneE164: contact.phoneE164,
          });
        } catch (e) {
          if (e instanceof IdentityConflictError) {
            return profileFail("identity_conflict");
          }
          throw e;
        }
        if (personId !== existing.id) {
          await participantSessionsService.updatePersonIdInTx(
            tx,
            params.session.sessionId,
            personId,
          );
        }
        await peopleService.applyVerificationResetInTx(tx, personId, {
          emailChanged,
          phoneChanged,
          previousEmailVerifiedAt: existing.emailVerifiedAt,
          previousPhoneVerifiedAt: existing.phoneVerifiedAt,
        });
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
              return profileFail("identity_conflict");
            }
            if (e.code === "duplicate_contact") {
              return profileFail("duplicate_contact");
            }
            return profileFail("invitee_not_found", e.message);
          }
          throw e;
        }
        await participantSessionsService.updatePersonIdInTx(
          tx,
          params.session.sessionId,
          personId,
        );
      } else {
        try {
          personId = await peopleService.ensurePersonInTx(tx, {
            givenName: gn,
            familyName: fn,
            email: contact.email,
            phoneE164: contact.phoneE164,
          });
        } catch (e) {
          if (e instanceof IdentityConflictError) {
            return profileFail("identity_conflict");
          }
          throw e;
        }
        await participantSessionsService.updatePersonIdInTx(
          tx,
          params.session.sessionId,
          personId,
        );
      }

      const person = await peopleService.getProfileRowInTx(tx, personId!);
      return { ok: true, profile: toProfileResponse(person, inviteFlow) };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Profile update failed.";
    log.error({ err: e }, msg);
    return profileFail("profile_update_failed", msg);
  }
}

export async function requestProfileVerification(params: {
  session: ParticipantSessionContext;
  channel: "email" | "phone";
  locale: "de" | "en" | "it";
}): Promise<
  | { ok: true; channel: "email" | "phone" }
  | ProfileFailure<RequestProfileVerificationFailureReason>
> {
  if (!params.session.personId) {
    return profileFail("profile_incomplete");
  }
  const person = await peopleService.getProfileRow(params.session.personId);
  if (!person) {
    return profileFail("profile_not_found");
  }
  if (params.channel === "email" && !person.email?.trim()) {
    return profileFail("no_email");
  }
  if (params.channel === "phone" && !person.phone?.trim()) {
    return profileFail("no_phone");
  }
  if (params.channel === "email" && isEmailVerified(person)) {
    return profileFail("email_verified");
  }
  if (params.channel === "phone" && isPhoneVerified(person)) {
    return profileFail("phone_verified");
  }

  const contactHash = contactHashForChannel(params.channel, person);
  if (!contactHash) {
    return profileFail("invalid_contact");
  }

  if (!isE2eTestMode() && params.channel === "email" && !isEmailEnabled) {
    return profileFail("email_not_configured");
  }
  if (!isE2eTestMode() && params.channel === "phone" && !isSmsEnabled()) {
    return profileFail("sms_not_configured");
  }

  const rawCode = issueRawOtpCode();
  await clearStaleOtpForCode(rawCode, {
    profileSessionId: params.session.sessionId,
  });
  const codeHash = hashOtpCode(rawCode);
  const expiresAt = new Date(Date.now() + REGISTRATION_EXCHANGE_TTL_MS);
  await profileVerificationCodesService.insert({
    sessionId: params.session.sessionId,
    codeHash,
    channel: params.channel,
    contactHash,
    expiresAt,
  });

  if (!isE2eTestMode()) {
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
      await profileVerificationCodesService.deleteByCodeHash(codeHash);
      const msg = e instanceof Error ? e.message : "Could not send verification code.";
      log.error({ err: e, channel: params.channel }, msg);
      return profileFail("delivery_failed", msg);
    }
    log.info({ sessionId: params.session.sessionId, channel: params.channel }, "Profile verification sent");
  } else {
    log.info(
      { sessionId: params.session.sessionId, channel: params.channel },
      "Profile verification code issued (E2E test mode, not sent)",
    );
  }
  return { ok: true, channel: params.channel };
}

export async function confirmProfileVerification(params: {
  session: ParticipantSessionContext;
  code: string;
}): Promise<
  | { ok: true; profile: ProfileMeResponse }
  | ProfileFailure<ConfirmProfileVerificationFailureReason>
> {
  if (!params.session.personId) {
    return profileFail("profile_incomplete");
  }

  const normalized = normalizeRegistrationExchangeCodeInput(params.code);
  if (!normalized) {
    return profileFail("invalid_code");
  }
  const codeHash = hashOtpCode(normalized);
  const inviteFlow = sessionInviteFlow(params.session);

  return await runTransaction(async (tx) => {
    const codeRow = await profileVerificationCodesService.findValid(
      codeHash,
      params.session.sessionId,
      tx,
    );
    if (!codeRow) {
      return profileFail("invalid_code");
    }

    const personRow = await peopleService.getProfileRowInTx(tx, params.session.personId!);
    if (!personRow) {
      return profileFail("profile_not_found");
    }

    const expectedHash = contactHashForChannel(codeRow.channel, personRow);
    if (!expectedHash || expectedHash !== codeRow.contactHash) {
      return profileFail("contact_changed");
    }

    await profileVerificationCodesService.markUsedInTx(tx, codeRow.id);

    const updated = await peopleService.markContactVerifiedInTx(
      tx,
      params.session.personId!,
      codeRow.channel,
    );

    return {
      ok: true,
      profile: toProfileResponse(updated, inviteFlow),
    };
  });
}

export async function isSessionProfileComplete(
  session: ParticipantSessionContext,
): Promise<boolean> {
  if (!session.personId) {
    return false;
  }
  const person = await peopleService.getProfileRow(session.personId);
  return person ? isProfileComplete(person) : false;
}