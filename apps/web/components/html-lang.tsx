"use client";

import { useEffect } from "react";

/** Sets the correct lang attribute on <html> for the active locale. */
export function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
