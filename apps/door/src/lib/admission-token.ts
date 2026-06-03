const ADMISSION_TOKEN_RE = /^[0-9a-f]{32}$/i;

/** Normalize QR payload to a 32-char hex admission token, or null if invalid. */
export function normalizeAdmissionToken(raw: string): string | null {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  let candidate = trimmed;

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const tokenParam = url.searchParams.get("token");

      if (tokenParam) {
        candidate = tokenParam;
      } else {
        const segments = url.pathname.split("/").filter(Boolean);

        candidate = segments[segments.length - 1] ?? trimmed;
      }
    }
  } catch {
    candidate = trimmed;
  }

  const normalized = candidate.trim().toLowerCase();

  if (!ADMISSION_TOKEN_RE.test(normalized)) {
    return null;
  }

  return normalized;
}
