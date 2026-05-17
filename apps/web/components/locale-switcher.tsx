"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";

import { saveLocale } from "@/i18n/client";
import { locales, type Locale } from "@/i18n/config";

export function LocaleSwitcher() {
  const pathname = usePathname();

  /** Swap the locale prefix in the current path. */
  function getLocalePath(targetLocale: Locale) {
    const segments = pathname.split("/");

    // segments[0] is "", segments[1] is the current locale
    segments[1] = targetLocale;

    return segments.join("/");
  }

  // Determine current locale from URL
  const currentLocale = pathname.split("/")[1] as Locale;

  return (
    <div className="flex items-center gap-1.5">
      {locales.map((loc, i) => (
        <span key={loc} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="text-foreground/15 text-[0.625rem]">/</span>
          )}
          <NextLink
            className={`text-[0.625rem] font-mono uppercase tracking-widest transition-colors duration-300 ${
              loc === currentLocale
                ? "text-neon"
                : "text-foreground/30 hover:text-neon"
            }`}
            href={getLocalePath(loc)}
            onClick={() => saveLocale(loc)}
          >
            {loc}
          </NextLink>
        </span>
      ))}
    </div>
  );
}
