"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  buildEventHref,
  buildReturnPath,
  resolveEventLinkQuery,
  type ResolvedEventLinkQuery,
} from "@/helpers/event-link-query";

export function usePersistedEventLinkQuery() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [resolved, setResolved] = useState<ResolvedEventLinkQuery>(() =>
    resolveEventLinkQuery(searchParams),
  );

  useEffect(() => {
    setResolved(resolveEventLinkQuery(searchParams));
  }, [searchParams]);

  const appendToHref = useMemo(
    () => (basePath: string, extra?: ResolvedEventLinkQuery) => {
      return buildEventHref(basePath, { ...resolved, ...extra }, searchParams);
    },
    [resolved, searchParams],
  );

  const returnPath = useMemo(
    () => (path?: string) =>
      buildReturnPath(path ?? pathname, searchParams, resolved),
    [pathname, resolved, searchParams],
  );

  return {
    invite: resolved.invite,
    promo: resolved.promo,
    appendToHref,
    returnPath,
  };
}
