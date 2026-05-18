"use client";

import { useSearchParams } from "next/navigation";

export function useEventUrlParams() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? undefined;
  const code = searchParams.get("code") ?? undefined;
  const loginPrefill = searchParams.get("login")?.trim() || undefined;

  return { inviteToken, code, loginPrefill };
}
