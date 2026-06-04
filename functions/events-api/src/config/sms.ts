/** Twilio Messaging Service SID (MG + 32 hex). When set, `messages.create` uses it instead of `from`. */
export const MG_SID_RE = /^MG[0-9a-f]{32}$/i;

/** Twilio Account SID (AC + 32 hex). Reject placeholders so module load does not throw. */
export const AC_SID_RE = /^AC[0-9a-f]{32}$/i;

/** One GSM-7 segment (no UCS-2) — Twilio bills extra when length or charset forces multipart. */
export const GSM7_SINGLE_SEGMENT_MAX = 160;

/**
 * Only characters we use in registration SMS (code + https URL). All are on the GSM 03.38
 * default alphabet, so Twilio keeps GSM-7 encoding (160 chars/segment). Rejects emoji,
 * umlauts, smart punctuation, and ASCII like `{|}~\`^[]` that are not GSM-default.
 */
export const REGISTRATION_SMS_BODY_SAFE = /^[\n @A-Za-z0-9:/?#=&.%+_()-]*$/;

export const SMS_MISSING_CREDENTIALS_MESSAGE =
  "SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM, and either TWILIO_AUTH_TOKEN or (TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET for a restricted API key).";
