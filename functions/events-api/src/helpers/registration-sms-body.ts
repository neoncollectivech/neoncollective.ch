import { GSM7_SINGLE_SEGMENT_MAX } from "../config/sms";
import { formatOtpDisplayCode, normalizeRegistrationExchangeCodeInput } from "./otp";

/** Host (and non-default port) for Web OTP / SMS autofill binding (`@host #code`). */
export function webOtpBindingFromPublicSiteUrl(publicSiteUrl: string): string {
  let u: URL;
  try {
    u = new URL(publicSiteUrl);
  } catch {
    return "localhost";
  }
  const defaultPort = u.protocol === "https:" ? "443" : "80";
  if (u.port && u.port !== defaultPort) {
    return `${u.hostname}:${u.port}`;
  }
  return u.hostname;
}

/**
 * Registration / profile verification SMS (GSM-7). Includes Web OTP suffix for mobile autofill.
 * `accessUrl` may be empty (profile phone verify); magic-link line is omitted when blank.
 */
export function buildRegistrationSmsBody(params: {
  rawCode: string;
  accessUrl: string;
  webOtpBinding: string;
}): string | { error: string } {
  const normalized = normalizeRegistrationExchangeCodeInput(params.rawCode);
  if (!normalized) {
    return { error: "Invalid registration code for SMS." };
  }

  const lines = [`NEON ${formatOtpDisplayCode(normalized)}`];
  const accessUrl = params.accessUrl.trim();
  if (accessUrl) {
    lines.push(accessUrl);
  }
  lines.push(`@${params.webOtpBinding} #${normalized}`);

  const body = lines.join("\n");
  if (body.length > GSM7_SINGLE_SEGMENT_MAX) {
    return {
      error:
        "SMS template too long for one GSM-7 segment. Use a shorter PUBLIC_SITE_URL / path.",
    };
  }

  return body;
}
