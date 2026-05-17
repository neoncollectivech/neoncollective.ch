import { parsePhoneNumber } from "libphonenumber-js";

/** Fix common domain typos like `gmail,com` (comma instead of dot). */
export function normalizeEmailTypo(raw: string): string {
  const t = raw.trim();
  const at = t.indexOf("@");
  if (at === -1) {
    return t;
  }
  const local = t.slice(0, at);
  const domain = t.slice(at + 1).replace(/,/g, ".");
  return `${local.toLowerCase()}@${domain.toLowerCase()}`;
}

export type ParsedContact =
  | { kind: "email"; email: string }
  | { kind: "phone"; e164: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Strip zero-width / BOM characters often pasted from contacts apps. */
function stripInvisibleInput(raw: string): string {
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

export function parseContactInput(
  raw: string,
): ParsedContact | { kind: "invalid"; reason: string } {
  const trimmed = stripInvisibleInput(raw);
  if (!trimmed) {
    return { kind: "invalid", reason: "Empty contact." };
  }
  if (trimmed.includes("@")) {
    const email = normalizeEmailTypo(trimmed);
    if (!EMAIL_RE.test(email)) {
      return { kind: "invalid", reason: "Invalid email address." };
    }
    return { kind: "email", email };
  }
  try {
    const parsed = parsePhoneNumber(trimmed, "CH");
    if (!parsed?.isValid()) {
      return { kind: "invalid", reason: "Invalid phone number." };
    }
    return { kind: "phone", e164: parsed.number };
  } catch {
    return { kind: "invalid", reason: "Invalid phone number." };
  }
}

export function normalizeOptionalPhoneE164(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) {
    return null;
  }
  const parsed = parseContactInput(raw.trim());
  if (parsed.kind !== "phone") {
    return null;
  }
  return parsed.e164;
}

/** DB format: leading + stripped, digits only (e.g. +41 79 123 45 67 → 41791234567). */
export function phoneDigitsFromE164(e164: string): string {
  return e164.replace(/\D/g, "");
}

/** Parse user input to DB digits (E.164 via libphonenumber, default country CH). */
export function phoneToStoredDigits(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }
  const trimmed = raw.trim();
  let e164 = normalizeOptionalPhoneE164(trimmed);
  // CSV exports often omit "+"; retry as international before giving up.
  if (!e164) {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) {
      e164 = normalizeOptionalPhoneE164(`+${digits}`);
    }
  }
  if (!e164) {
    return null;
  }
  return phoneDigitsFromE164(e164);
}
