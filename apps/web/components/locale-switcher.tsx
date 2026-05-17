"use client";

import { Suspense } from "react";
import { Button } from "@heroui/button";
import NextLink from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";

import { saveLocale } from "@/i18n/client";
import { locales, type Locale } from "@/i18n/config";

function LocaleSwitcherInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function getLocalePath(targetLocale: Locale) {
    const segments = pathname.split("/");

    segments[1] = targetLocale;
    const path = segments.join("/");
    const query = searchParams.toString();

    return query ? `${path}?${query}` : path;
  }

  const currentLocale = pathname.split("/")[1] as Locale;

  return (
    <div className="flex items-center gap-1.5">
      {locales.map((loc, i) => (
        <span key={loc} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="text-foreground/15 text-[0.625rem]">/</span>
          )}
          <Button
            as={NextLink}
            className={clsx(
              "min-w-0 h-auto px-0 py-0 font-mono text-[0.625rem] uppercase tracking-widest bg-transparent",
              loc === currentLocale
                ? "text-neon"
                : "text-foreground/30 hover:text-neon",
            )}
            href={getLocalePath(loc)}
            radius="none"
            size="sm"
            variant="light"
            onPress={() => saveLocale(loc)}
          >
            {loc}
          </Button>
        </span>
      ))}
    </div>
  );
}

export function LocaleSwitcher() {
  return (
    <Suspense fallback={null}>
      <LocaleSwitcherInner />
    </Suspense>
  );
}
