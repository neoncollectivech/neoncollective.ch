export const API_KEY_SCOPES = [
  "check_in",
  "pos",
  "pos_admin",
  "admissions_list",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const DEFAULT_EVENT_API_KEY_SCOPES: ApiKeyScope[] = ["check_in", "pos"];

export const DEFAULT_GLOBAL_API_KEY_SCOPES: ApiKeyScope[] = [
  "check_in",
  "pos",
  "pos_admin",
  "admissions_list",
];

const VALID_SCOPES = new Set<string>(API_KEY_SCOPES);

export function defaultScopesForApiKey(eventId: string | null): ApiKeyScope[] {
  return eventId === null
    ? [...DEFAULT_GLOBAL_API_KEY_SCOPES]
    : [...DEFAULT_EVENT_API_KEY_SCOPES];
}

export function normalizeApiKeyScopes(scopes: readonly string[]): ApiKeyScope[] {
  const normalized = scopes.filter((scope): scope is ApiKeyScope => VALID_SCOPES.has(scope));
  return normalized.length > 0 ? normalized : [...DEFAULT_EVENT_API_KEY_SCOPES];
}

export function apiKeyHasScope(
  key: { scopes: readonly ApiKeyScope[] },
  scope: ApiKeyScope,
): boolean {
  return key.scopes.includes(scope);
}

export function apiKeyHasEveryScope(
  key: { scopes: readonly ApiKeyScope[] },
  required: readonly ApiKeyScope[],
): boolean {
  return required.every((scope) => apiKeyHasScope(key, scope));
}
