"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { resolveEventLinkQuery } from "@/helpers/event-link-query";

/**
 * URL `invite` / `promo`: query param wins and is saved to sessionStorage; else
 * sessionStorage; else absent (no link promo). Plus `code` and `login` from URL only.
 */
export function useEventUrlParams() {
  const searchParams = useSearchParams();
  const { invite, promo } = useMemo(
    () => resolveEventLinkQuery(searchParams),
    [searchParams],
  );
  const code = searchParams.get("code") ?? undefined;
  const loginPrefill = searchParams.get("login")?.trim() || undefined;

  return { inviteToken: invite, promo, code, loginPrefill };
}
