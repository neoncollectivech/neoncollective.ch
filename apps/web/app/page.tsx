"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { detectBrowserLocale, getSavedLocale } from "@/i18n/client";

/**
 * Root redirect using locale detection chain:
 *   1. Saved locale in localStorage (explicit user choice)
 *   2. Browser language preference (navigator.languages)
 *   3. Fallback to "en"
 *
 * With static export, server-side redirect() is not available,
 * so we use a client-side redirect.
 *
 * When output: "export" is removed, replace with middleware.ts
 * for server-side browser locale detection and redirect.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const locale = getSavedLocale() ?? detectBrowserLocale();

    router.replace(`/${locale}`);
  }, [router]);

  return null;
}
