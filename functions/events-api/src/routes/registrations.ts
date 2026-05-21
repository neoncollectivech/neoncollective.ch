import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { normalizeOptionalPhoneE164 } from "../helpers/contact";
import {
  anonymousSessionSchema,
  profileUpdateSchema,
  profileVerificationConfirmSchema,
  profileVerificationRequestSchema,
  sessionExchangeSchema,
  sessionPhoneSchema,
  sessionRequestSchema,
} from "../schemas";
import {
  confirmProfileVerification,
  type ConfirmProfileVerificationFailureReason,
  getParticipantProfile,
  requestProfileVerification,
  type RequestProfileVerificationFailureReason,
  updateParticipantProfile,
  type UpdateParticipantProfileFailureReason,
} from "./registrations/profile";
import {
  createAnonymousParticipantSession,
  type CreateAnonymousSessionFailureReason,
  exchangeRegistrationCode,
  type ExchangeRegistrationCodeFailureReason,
  requestRegistrationSession,
  type RequestRegistrationSessionFailureReason,
  resolveParticipantIdentityFromCookie,
  resolveParticipantSessionFromCookie,
  resolveParticipantSessionCookieCrossSite,
} from "./registrations/session";
import { peopleService } from "../services/people.service";
import {
  clientIpForRateLimit,
  consumeExchangeRateLimit,
} from "./shared/rate-limit";
import { databaseUnavailableResponse, requireDatabase, requireParticipantSession } from "./shared/guards";
import { jsonReasonFailure } from "./shared/respond";

const SESSION_REQUEST_ERRORS: Record<
  RequestRegistrationSessionFailureReason,
  { status: ContentfulStatusCode; error: string }
> = {
  invalid_contact: { status: 400, error: "Invalid contact." },
  invalid_return_url: { status: 400, error: "Invalid return URL." },
  email_not_configured: {
    status: 503,
    error:
      "Email is not configured. Set RESEND_API_KEY and FROM_EMAIL (address on a domain verified in Resend).",
  },
  registration_not_found: { status: 404, error: "No registration found for this contact." },
  delivery_failed: { status: 503, error: "Could not deliver verification message." },
  sms_not_configured: {
    status: 503,
    error:
      "SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM, and either TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET.",
  },
};

const SESSION_EXCHANGE_ERRORS: Record<
  ExchangeRegistrationCodeFailureReason,
  { status: ContentfulStatusCode; error: string }
> = {
  invalid_code: { status: 400, error: "Invalid or expired code." },
};

const ANONYMOUS_SESSION_ERRORS: Record<
  CreateAnonymousSessionFailureReason,
  { status: ContentfulStatusCode; error: string }
> = {
  invalid_invite_link: { status: 400, error: "Invalid invite link." },
  invites_not_for_public: { status: 400, error: "Invites are not used for public events." },
};

const PROFILE_UPDATE_ERRORS: Record<
  UpdateParticipantProfileFailureReason,
  { status: ContentfulStatusCode; error: string }
> = {
  names_required: { status: 400, error: "Given name and family name are required." },
  invalid_contact: { status: 400, error: "Invalid contact." },
  profile_not_found: { status: 404, error: "Profile not found." },
  identity_conflict: { status: 409, error: "These contact details belong to another profile." },
  duplicate_contact: { status: 409, error: "Email or phone is already in use." },
  invitee_not_found: { status: 404, error: "Invitee not found." },
  profile_update_failed: { status: 500, error: "Profile update failed." },
};

const PROFILE_VERIFY_REQUEST_ERRORS: Record<
  RequestProfileVerificationFailureReason,
  { status: ContentfulStatusCode; error: string }
> = {
  profile_incomplete: { status: 400, error: "Save your profile details first." },
  profile_not_found: { status: 404, error: "Profile not found." },
  no_email: { status: 400, error: "No email on profile." },
  no_phone: { status: 400, error: "No phone on profile." },
  email_verified: { status: 400, error: "Email is already verified." },
  phone_verified: { status: 400, error: "Phone is already verified." },
  invalid_contact: { status: 400, error: "Invalid contact for verification." },
  email_not_configured: {
    status: 503,
    error:
      "Email is not configured. Set RESEND_API_KEY and FROM_EMAIL (address on a domain verified in Resend).",
  },
  sms_not_configured: { status: 503, error: "SMS is not configured." },
  delivery_failed: { status: 503, error: "Could not send verification code." },
};

const PROFILE_VERIFY_CONFIRM_ERRORS: Record<
  ConfirmProfileVerificationFailureReason,
  { status: ContentfulStatusCode; error: string }
> = {
  profile_incomplete: { status: 400, error: "Save your profile details first." },
  invalid_code: { status: 400, error: "Invalid or expired code." },
  profile_not_found: { status: 404, error: "Profile not found." },
  contact_changed: { status: 400, error: "Contact changed — request a new code." },
};

export function createRegistrationsRouter(): Hono {
  const router = new Hono();

  router.get("/registrations/session/me", async (c) => {
    if (!requireDatabase(c)) {
      return c.json({ session: false });
    }
    const row = await resolveParticipantSessionFromCookie(c.req.header("Cookie"));
    if (!row) {
      return c.json({ session: false });
    }
    return c.json({
      session: true,
      ...(row.givenName ? { givenName: row.givenName } : {}),
      ...(row.familyName ? { familyName: row.familyName } : {}),
    });
  });

  router.post(
    "/registrations/session/request",
    arktypeValidator("json", sessionRequestSchema),
    async (c) => {
      const body = c.req.valid("json");
      const res = await requestRegistrationSession({
        contact: body.contact,
        locale: body.locale,
        returnUrl: body.returnUrl,
      });
      if (!res.ok) {
        return jsonReasonFailure(c, res, SESSION_REQUEST_ERRORS);
      }
      return c.json({ sent: true, channel: res.channel });
    },
  );

  router.post(
    "/registrations/session/exchange",
    arktypeValidator("json", sessionExchangeSchema),
    async (c) => {
      const ip = clientIpForRateLimit(c);
      if (!consumeExchangeRateLimit(ip)) {
        return c.json({ error: "Too many attempts. Try again later." }, 429);
      }
      const body = c.req.valid("json");
      const crossSite = resolveParticipantSessionCookieCrossSite({
        originHeader: c.req.header("Origin"),
        requestUrl: c.req.url,
      });
      const res = await exchangeRegistrationCode({
        code: body.code,
        crossSiteCookie: crossSite,
      });
      if (!res.ok) {
        return jsonReasonFailure(c, res, SESSION_EXCHANGE_ERRORS);
      }
      c.header("Set-Cookie", res.setCookie);
      return c.json({ ok: true });
    },
  );

  router.post(
    "/registrations/session/anonymous",
    arktypeValidator("json", anonymousSessionSchema),
    async (c) => {
      if (!requireDatabase(c)) {
        return databaseUnavailableResponse(c);
      }
      const body = c.req.valid("json");
      const crossSite = resolveParticipantSessionCookieCrossSite({
        originHeader: c.req.header("Origin"),
        requestUrl: c.req.url,
      });
      const res = await createAnonymousParticipantSession({
        inviteToken: body.inviteToken,
        crossSiteCookie: crossSite,
        cookieHeader: c.req.header("Cookie"),
      });
      if (!res.ok) {
        return jsonReasonFailure(c, res, ANONYMOUS_SESSION_ERRORS);
      }
      if (res.setCookie) {
        c.header("Set-Cookie", res.setCookie);
      }
      const profile = await getParticipantProfile(res.session);
      return c.json({
        anonymous: res.session.personId == null,
        created: res.created,
        ...profile,
      });
    },
  );

  router.get("/registrations/profile/me", async (c) => {
    if (!requireDatabase(c)) {
      return databaseUnavailableResponse(c);
    }
    const session = await requireParticipantSession(c);
    if (session instanceof Response) {
      return session;
    }
    const profile = await getParticipantProfile(session);
    return c.json(profile);
  });

  router.put("/registrations/profile", arktypeValidator("json", profileUpdateSchema), async (c) => {
    if (!requireDatabase(c)) {
      return databaseUnavailableResponse(c);
    }
    const session = await requireParticipantSession(c);
    if (session instanceof Response) {
      return session;
    }
    const body = c.req.valid("json");
    const res = await updateParticipantProfile({
      session,
      givenName: body.givenName,
      familyName: body.familyName,
      email: body.email,
      phoneE164: body.phoneE164,
    });
    if (!res.ok) {
      return jsonReasonFailure(c, res, PROFILE_UPDATE_ERRORS);
    }
    return c.json(res.profile);
  });

  router.post(
    "/registrations/profile/verification/request",
    arktypeValidator("json", profileVerificationRequestSchema),
    async (c) => {
      if (!requireDatabase(c)) {
        return databaseUnavailableResponse(c);
      }
      const session = await requireParticipantSession(c);
      if (session instanceof Response) {
        return session;
      }
      const body = c.req.valid("json");
      const ip = clientIpForRateLimit(c);
      if (!consumeExchangeRateLimit(ip)) {
        return c.json({ error: "Too many attempts. Try again later." }, 429);
      }
      const res = await requestProfileVerification({
        session,
        channel: body.channel,
        locale: body.locale,
      });
      if (!res.ok) {
        return jsonReasonFailure(c, res, PROFILE_VERIFY_REQUEST_ERRORS);
      }
      return c.json({ sent: true, channel: res.channel });
    },
  );

  router.post(
    "/registrations/profile/verification/confirm",
    arktypeValidator("json", profileVerificationConfirmSchema),
    async (c) => {
      if (!requireDatabase(c)) {
        return databaseUnavailableResponse(c);
      }
      const session = await requireParticipantSession(c);
      if (session instanceof Response) {
        return session;
      }
      const body = c.req.valid("json");
      const ip = clientIpForRateLimit(c);
      if (!consumeExchangeRateLimit(ip)) {
        return c.json({ error: "Too many attempts. Try again later." }, 429);
      }
      const res = await confirmProfileVerification({ session, code: body.code });
      if (!res.ok) {
        return jsonReasonFailure(c, res, PROFILE_VERIFY_CONFIRM_ERRORS);
      }
      return c.json(res.profile);
    },
  );

  router.post(
    "/registrations/profile/phone",
    arktypeValidator("json", sessionPhoneSchema),
    async (c) => {
      if (!requireDatabase(c)) {
        return databaseUnavailableResponse(c);
      }
      const identity = await resolveParticipantIdentityFromCookie(c.req.header("Cookie"));
      if (!identity?.personId) {
        return c.json({ error: "Unauthorized." }, 401);
      }
      const body = c.req.valid("json");
      const e164 = normalizeOptionalPhoneE164(body.phoneE164);
      if (!e164) {
        return c.json({ error: "Invalid phone number." }, 400);
      }
      const res = await peopleService.attachPhoneToPerson({
        personId: identity.personId,
        phoneE164: e164,
      });
      if (!res.ok) {
        if (res.code === "not_found") {
          return c.json({ error: "Profile not found." }, 404);
        }
        return c.json(
          { error: "This phone number is already linked to another profile." },
          409 as ContentfulStatusCode,
        );
      }
      return c.json({ ok: true });
    },
  );

  return router;
}
