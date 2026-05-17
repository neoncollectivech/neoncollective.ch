import twilio from "twilio";

import { createLogger } from "@neon/server-kit";

const log = createLogger("sms");

/** Twilio Messaging Service SID (MG + 32 hex). When set, `messages.create` uses it instead of `from`. */
const MG_SID_RE = /^MG[0-9a-f]{32}$/i;
/** Twilio Account SID (AC + 32 hex). Reject placeholders so module load does not throw. */
const AC_SID_RE = /^AC[0-9a-f]{32}$/i;

/**
 * Outbound sender for `messages.create`:
 * - `TWILIO_MESSAGING_SERVICE_SID` (recommended for alphanumeric + fallbacks): Twilio Console → Messaging → Services.
 * - Else `TWILIO_FROM`: E.164 Twilio number (`+41…`) **or** alphanumeric sender ID.
 *
 * Alphanumeric IDs are **max 11 characters** after collapsing spaces (Twilio API). Destinations like CH
 * can show them, but Twilio still validates the string — long names like "NEON Collective" are rejected.
 */
function twilioOutboundParams():
  | { messagingServiceSid: string }
  | { from: string }
  | { error: string } {
  const mg = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() ?? "";
  if (mg.length > 0) {
    if (!MG_SID_RE.test(mg)) {
      return {
        error:
          "TWILIO_MESSAGING_SERVICE_SID must look like MG + 32 hex chars (Messaging Service SID from Twilio Console).",
      };
    }
    return { messagingServiceSid: mg };
  }

  const raw = process.env.TWILIO_FROM?.trim() ?? "";
  if (!raw) {
    return { error: "Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM." };
  }

  if (/^\+[1-9]\d{6,14}$/.test(raw)) {
    return { from: raw };
  }

  const compact = raw.replace(/\s+/g, "");
  if (compact.length < 1) {
    return { error: "TWILIO_FROM is empty after removing spaces." };
  }
  if (compact.length > 11) {
    return {
      error:
        `Alphanumeric TWILIO_FROM must be at most 11 characters for Twilio ("${compact}" is ${compact.length}). Use a short ID (e.g. NEON), a +E.164 Twilio number, or TWILIO_MESSAGING_SERVICE_SID with senders configured in Twilio.`,
    };
  }
  return { from: compact };
}

/**
 * Twilio supports two server credential styles:
 * - Account SID (AC…) + Auth Token
 * - Account SID (AC…) + API Key SID (SK…) + API Key Secret (restricted keys)
 */
function twilioClient(): ReturnType<typeof twilio> | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  if (!accountSid || !AC_SID_RE.test(accountSid)) {
    return null;
  }
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim();
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim();
  if (apiKeySid && apiKeySecret) {
    return twilio(apiKeySid, apiKeySecret, { accountSid });
  }
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (authToken) {
    return twilio(accountSid, authToken);
  }
  return null;
}

function twilioOutboundConfigured(): boolean {
  const mg = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() ?? "";
  if (mg.length > 0 && MG_SID_RE.test(mg)) {
    return true;
  }
  const raw = process.env.TWILIO_FROM?.trim() ?? "";
  if (!raw) {
    return false;
  }
  if (/^\+[1-9]\d{6,14}$/.test(raw)) {
    return true;
  }
  const compact = raw.replace(/\s+/g, "");
  return compact.length >= 1 && compact.length <= 11;
}

export function isSmsEnabled(): boolean {
  return Boolean(twilioClient()) && twilioOutboundConfigured();
}

const missingCredentialsMessage =
  "SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM, and either TWILIO_AUTH_TOKEN or (TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET for a restricted API key).";

/** One GSM-7 segment (no UCS-2) — Twilio bills extra when length or charset forces multipart. */
const GSM7_SINGLE_SEGMENT_MAX = 160;

/**
 * Only characters we use in registration SMS (code + https URL). All are on the GSM 03.38
 * default alphabet, so Twilio keeps GSM-7 encoding (160 chars/segment). Rejects emoji,
 * umlauts, smart punctuation, and ASCII like `{|}~\`^[]` that are not GSM-default.
 */
const REGISTRATION_SMS_BODY_SAFE = /^[\n A-Za-z0-9:/?#=&.%+_()-]*$/;

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
  const client = twilioClient();
  if (!client) {
    return { ok: false, error: missingCredentialsMessage };
  }

  const outbound = twilioOutboundParams();
  if ("error" in outbound) {
    return { ok: false, error: outbound.error };
  }

  // One line break only; ASCII labels so entire body stays GSM-7 and fits one segment.
  const body = `NEON ${params.code}\n${params.accessUrl}`;
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

  try {
    await client.messages.create({
      body,
      to: params.toE164,
      ...outbound,
    });
    log.info({ to: params.toE164 }, "Registration SMS sent");
    return { ok: true };
  } catch (e) {
    const raw = e instanceof Error ? e.message : "SMS send failed.";
    log.error({ err: e }, raw);
    return { ok: false, error: twilioSendErrorMessage(raw) };
  }
}
