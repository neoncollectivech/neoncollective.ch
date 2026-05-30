import { createLogger } from "@neon/server-kit";

import { getEventsApiEnv } from "../config/runtime-env";
import {
  GSM7_SINGLE_SEGMENT_MAX,
  REGISTRATION_SMS_BODY_SAFE,
  SMS_MISSING_CREDENTIALS_MESSAGE,
} from "../config/sms";
import {
  isTwilioOutboundConfigured,
  resolveTwilioCredentials,
  resolveTwilioOutboundParams,
  sendTwilioSms,
} from "./twilio-rest";
import { formatOtpDisplayCode } from "./otp";

const log = createLogger("sms");

export function isSmsEnabled(): boolean {
  const env = getEventsApiEnv();
  return Boolean(resolveTwilioCredentials(env)) && isTwilioOutboundConfigured(env);
}

function isSingleGsmSegmentRegistrationSms(body: string): boolean {
  if (body.length > GSM7_SINGLE_SEGMENT_MAX) {
    return false;
  }
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

  const body = `NEON ${formatOtpDisplayCode(params.code)}\n${params.accessUrl}`;
  if (!isSingleGsmSegmentRegistrationSms(body)) {
    log.error(
      { len: body.length, to: params.toE164 },
      "Registration SMS exceeds one GSM-7 segment or contains disallowed characters",
    );
    return {
      ok: false,
      error:
        "SMS template too long or non-ASCII for one segment. Use a shorter PUBLIC_SITE_URL / path, ASCII-only slugs, and no special characters.",
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
