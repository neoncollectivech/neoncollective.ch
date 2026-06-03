import { createLocalJWKSet, jwtVerify, type JWK } from "jose";

import { api } from "@/lib/api-client";
import {
  readPersistedItem,
  writePersistedItem,
} from "@/lib/storage/persisted-storage";

const JWKS_CACHE_PREFIX = "neon:door:jwks:";

export type CachedAdmissionJwks = {
  eventId: string;
  kid: string;
  keys: JWK[];
  fetchedAt: number;
};

export async function fetchAdmissionJwks(params: {
  apiKey: string;
  eventId?: string | null;
}): Promise<CachedAdmissionJwks> {
  const { data } = await api.get<{
    eventId: string;
    kid: string;
    keys: JWK[];
  }>("/admission/jwks", {
    params: params.eventId ? { eventId: params.eventId } : undefined,
    headers: { Authorization: `Bearer ${params.apiKey}` },
  });

  const cached: CachedAdmissionJwks = {
    eventId: data.eventId,
    kid: data.kid,
    keys: data.keys,
    fetchedAt: Date.now(),
  };

  writePersistedItem(
    `${JWKS_CACHE_PREFIX}${data.eventId}`,
    JSON.stringify(cached),
  );

  return cached;
}

export function readCachedAdmissionJwks(
  eventId: string,
): CachedAdmissionJwks | null {
  const raw = readPersistedItem(`${JWKS_CACHE_PREFIX}${eventId}`);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CachedAdmissionJwks;
  } catch {
    return null;
  }
}

export async function verifyAdmissionCredentialOffline(params: {
  credential: string;
  eventId: string;
}): Promise<
  | { ok: true; admissionId: string }
  | { ok: false; reason: "invalid" | "wrong_event" | "jwks_missing" }
> {
  const cached = readCachedAdmissionJwks(params.eventId);

  if (!cached || cached.keys.length === 0) {
    return { ok: false, reason: "jwks_missing" };
  }

  const jwks = createLocalJWKSet({ keys: cached.keys });

  try {
    const { payload } = await jwtVerify(params.credential.trim(), jwks, {
      issuer: "neon-admissions",
      audience: "neon-door",
      algorithms: ["EdDSA"],
    });

    const admissionId = typeof payload.sub === "string" ? payload.sub : "";
    const evt = typeof payload.evt === "string" ? payload.evt : "";

    if (!admissionId || evt !== params.eventId) {
      return {
        ok: false,
        reason: evt !== params.eventId ? "wrong_event" : "invalid",
      };
    }

    return { ok: true, admissionId };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
