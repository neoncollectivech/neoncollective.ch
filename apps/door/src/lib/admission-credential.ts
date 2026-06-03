/** Trim QR payload; admission credentials are JWT compact strings. */
export function normalizeAdmissionCredential(raw: string): string | null {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  let candidate = trimmed;

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const credentialParam = url.searchParams.get("credential");

      if (credentialParam) {
        candidate = credentialParam;
      } else {
        const segments = url.pathname.split("/").filter(Boolean);

        candidate = segments[segments.length - 1] ?? trimmed;
      }
    }
  } catch {
    candidate = trimmed;
  }

  const normalized = candidate.trim();

  if (!normalized.startsWith("eyJ")) {
    return null;
  }

  return normalized;
}
