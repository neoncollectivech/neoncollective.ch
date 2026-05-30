"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import {
  buildEventHref,
  buildReturnPath,
  resolveEventLinkQuery,
  type ResolvedEventLinkQuery,
} from "@/helpers/event-link-query";

/**
 * Resolved invite/promo link state plus helpers for hrefs and return paths.
 */
export function useEventLinkState() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const linkQuery = useMemo(
    () => resolveEventLinkQuery(searchParams),
    [searchParams],
  );
  const code = searchParams.get("code") ?? undefined;
  const loginPrefill = searchParams.get("login")?.trim() || undefined;

  const appendToHref = useMemo(
    () => (basePath: string, extra?: ResolvedEventLinkQuery) =>
      buildEventHref(basePath, { ...linkQuery, ...extra }, searchParams),
    [linkQuery, searchParams],
  );

  const returnPath = useMemo(
    () => (path?: string) =>
      buildReturnPath(path ?? pathname, searchParams, linkQuery),
    [linkQuery, pathname, searchParams],
  );

  return {
    inviteToken: linkQuery.invite,
    promo: linkQuery.promo,
    linkQuery,
    code,
    loginPrefill,
    appendToHref,
    returnPath,
  };
}
