import { apiKeysService, isApiKeyTokenFormat } from "../../services/api-keys.service";
import { sha256Hex } from "../../helpers/token";
import type { ApiKeyScope } from "../../config/api-keys";
import { normalizeApiKeyScopes } from "../../config/api-keys";

export type EventApiKeyAuth = {
  keyId: string;
  /** Null = global key (all events). */
  eventId: string | null;
  label: string;
  scopes: ApiKeyScope[];
};

export function apiKeyGrantsEvent(
  key: Pick<EventApiKeyAuth, "eventId">,
  eventId: string,
): boolean {
  return key.eventId === null || key.eventId === eventId;
}

/** True when the key is not scoped to a single event (merchant-level ops). */
export function isGlobalApiKey(key: Pick<EventApiKeyAuth, "eventId">): boolean {
  return key.eventId === null;
}

export async function resolveEventApiKey(token: string): Promise<EventApiKeyAuth | null> {
  const trimmed = token.trim();
  if (!isApiKeyTokenFormat(trimmed)) {
    return null;
  }
  const tokenHash = await sha256Hex(trimmed);
  const row = await apiKeysService.findActiveByTokenHash(tokenHash);
  if (!row) {
    return null;
  }
  apiKeysService.touchLastUsed(row.id);
  return {
    keyId: row.id,
    eventId: row.eventId,
    label: row.label,
    scopes: normalizeApiKeyScopes(row.scopes),
  };
}
