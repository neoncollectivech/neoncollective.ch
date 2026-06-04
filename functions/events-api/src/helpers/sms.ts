import { createLogger } from "@neon/server-kit";

import {
  REGISTRATION_SMS_BODY_SAFE,
  SMS_MISSING_CREDENTIALS_MESSAGE,
} from "../config/sms";
import { getEventsApiEnv } from "../config/runtime-env";
import {
  buildRegistrationSmsBody,
  webOtpBindingFromPublicSiteUrl,
} from "./registration-sms-body";
import {
  isTwilioOutboundConfigured,
  resolveTwilioCredentials,
  resolveTwilioOutboundParams,
  sendTwilioSms,
} from "./twilio-rest";

const log = createLogger("sms");

export function isSmsEnabled(): boolean {
  const env = getEventsApiEnv();
  return Boolean(resolveTwilioCredentials(env)) && isTwilioOutboundConfigured(env);
}

function isValidRegistrationSmsBody(body: string): boolean {
  return REGISTRATION_SMS_BODY_SAFE.test(body);
}

function twilioSendErrorMessage(raw: string): string {
  if (!/^authenticate$/i.test(raw.trim())) {
    return raw;
  }
  return "Twilio rejected the API credentials (check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN, or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET in production).";
}

export async function sendRegistrationSmsCode(params: {
  toE164: string;
  code: string;
  /** Same-origin GET URL with ?code= for tap-to-open sign-in (must be ASCII-only). */
  accessUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const env = getEventsApiEnv();
  const credentials = resolveTwilioCredentials(env);
  if (!credentials) {
    return { ok: false, error: SMS_MISSING_CREDENTIALS_MESSAGE };
  }

  const outbound = resolveTwilioOutboundParams(env);
  if ("error" in outbound) {
    return { ok: false, error: outbound.error };
  }

  const built = buildRegistrationSmsBody({
    rawCode: params.code,
    accessUrl: params.accessUrl,
    webOtpBinding: webOtpBindingFromPublicSiteUrl(env.publicSiteUrl),
  });
  if (typeof built !== "string") {
    log.error({ to: params.toE164 }, built.error);
    return { ok: false, error: built.error };
  }
  const body = built;
  if (!isValidRegistrationSmsBody(body)) {
    log.error(
      { len: body.length, to: params.toE164 },
      "Registration SMS contains disallowed characters",
    );
    return {
      ok: false,
      error:
        "SMS template has non-ASCII or disallowed characters. Use ASCII-only PUBLIC_SITE_URL / slugs.",
    };
  }

  const result = await sendTwilioSms({
    credentials,
    to: params.toE164,
    body,
    outbound,
  });
  if (!result.ok) {
    log.error({ to: params.toE164, error: result.error }, result.error);
    return { ok: false, error: twilioSendErrorMessage(result.error) };
  }

  log.info({ to: params.toE164 }, "Registration SMS sent");
  return { ok: true };
}
