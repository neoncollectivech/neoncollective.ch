"use client";

import type { Locale } from "@/i18n/config";

import { useDictionary } from "@/i18n/DictionaryContext";

/** Current locale from `DictionaryProvider` (under `app/[locale]/`). */
export function useLocale(): Locale {
  return useDictionary().locale;
}
