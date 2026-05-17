import { locales, type Locale } from "./config";

const STORAGE_KEY = "neon-locale";

/** Retrieve the locale the user explicitly chose via the language switcher. */
export function getSavedLocale(): Locale | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    return locales.includes(saved as Locale) ? (saved as Locale) : null;
  } catch {
    return null;
  }
}

/** Persist the user's explicit language choice across sessions. */
export function saveLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* SSR or private-browsing guard */
  }
}

/**
 * Infer the best locale from the browser's language preferences.
 * Falls back to "en" when no browser language matches a supported locale,
 * so non-German speakers get the English version by default.
 */
export function detectBrowserLocale(): Locale {
  const langs = navigator.languages ?? [navigator.language];

  for (const lang of langs) {
    const prefix = lang.split("-")[0].toLowerCase();

    if (locales.includes(prefix as Locale)) return prefix as Locale;
  }

  return "en";
}
