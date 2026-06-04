export const EVENT_LINK_QUERY = {
  invite: { urlKey: "invite", storageScope: "events" },
  promo: { urlKey: "promo", storageScope: "events" },
} as const;

export type EventLinkQueryKey = keyof typeof EVENT_LINK_QUERY;

export type ResolvedEventLinkQuery = {
  invite?: string;
  promo?: string;
};

/** One-time sign-in params — must not be copied across client navigations. */
export const ONE_TIME_AUTH_URL_PARAMS = ["code", "login"] as const;

export function stripOneTimeAuthSearchParams(
  search: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(search.toString());
  for (const key of ONE_TIME_AUTH_URL_PARAMS) {
    next.delete(key);
  }
  return next;
}

function storageKey(scope: string, urlKey: string): string {
  return `neon:eventLink:${scope}:${urlKey}`;
}

export function readUrlParam(
  searchParams: URLSearchParams,
  urlKey: string,
): string | undefined {
  const value = searchParams.get(urlKey)?.trim();

  return value || undefined;
}

export function readStored(scope: string, urlKey: string): string | undefined {
  if (typeof sessionStorage === "undefined") {
    return undefined;
  }
  const value = sessionStorage.getItem(storageKey(scope, urlKey))?.trim();

  return value || undefined;
}

export function writeStored(
  scope: string,
  urlKey: string,
  value: string,
): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.setItem(storageKey(scope, urlKey), value);
}

/**
 * Resolve invite/promo (or similar) for checkout:
 * 1. Non-empty URL query param → use it and persist to sessionStorage.
 * 2. No param in URL → use sessionStorage if present.
 * 3. Otherwise → undefined (no invite/promo/discount from link state).
 */
export function resolveLinkQueryParam(params: {
  urlValue: string | undefined;
  scope: string;
  urlKey: string;
}): string | undefined {
  const fromUrl = params.urlValue?.trim();

  if (fromUrl) {
    writeStored(params.scope, params.urlKey, fromUrl);

    return fromUrl;
  }

  return readStored(params.scope, params.urlKey);
}

export function resolveEventLinkQuery(
  searchParams: URLSearchParams,
): ResolvedEventLinkQuery {
  const resolved: ResolvedEventLinkQuery = {};

  for (const key of Object.keys(EVENT_LINK_QUERY) as EventLinkQueryKey[]) {
    const { urlKey, storageScope } = EVENT_LINK_QUERY[key];
    const value = resolveLinkQueryParam({
      urlValue: readUrlParam(searchParams, urlKey),
      scope: storageScope,
      urlKey,
    });

    if (value) {
      resolved[key] = value;
    }
  }

  return resolved;
}

export function appendLinkQueryToSearchParams(
  params: URLSearchParams,
  resolved: ResolvedEventLinkQuery,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());

  for (const key of Object.keys(EVENT_LINK_QUERY) as EventLinkQueryKey[]) {
    const { urlKey } = EVENT_LINK_QUERY[key];

    next.delete(urlKey);
    const value = resolved[key];

    if (value) {
      next.set(urlKey, value);
    }
  }

  return next;
}

export function buildEventHref(
  basePath: string,
  resolved: ResolvedEventLinkQuery,
  existingSearch?: URLSearchParams,
): string {
  const question = basePath.indexOf("?");
  const path = question >= 0 ? basePath.slice(0, question) : basePath;
  const params = new URLSearchParams(
    question >= 0 ? basePath.slice(question + 1) : "",
  );

  if (existingSearch) {
    stripOneTimeAuthSearchParams(existingSearch).forEach((value, key) => {
      params.set(key, value);
    });
  }
  const merged = appendLinkQueryToSearchParams(params, resolved);
  const qs = merged.toString();

  return qs ? `${path}?${qs}` : path;
}

export function buildReturnPath(
  pathname: string,
  searchParams: URLSearchParams,
  resolved?: ResolvedEventLinkQuery,
): string {
  const query = resolved ?? resolveEventLinkQuery(searchParams);

  return buildEventHref(pathname, query, searchParams);
}
