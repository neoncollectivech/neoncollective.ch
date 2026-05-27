"use client";

import { useSearchParams } from "next/navigation";

import { usePersistedEventLinkQuery } from "@/hooks/use-persisted-event-link-query";

export function useEventUrlParams() {
  const searchParams = useSearchParams();
  const { invite, promo } = usePersistedEventLinkQuery();
  const code = searchParams.get("code") ?? undefined;
  const loginPrefill = searchParams.get("login")?.trim() || undefined;

  return { inviteToken: invite, promo, code, loginPrefill };
}
