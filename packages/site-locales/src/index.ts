export const locales = ["de", "en", "it"] as const;

export type Locale = (typeof locales)[number];

export type LocalizedText = Partial<Record<Locale, string>>;

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
  it: "Italiano",
};

/** ArkType fragment for sparse locale maps in admin/API schemas. */
export const localizedTextArkType = "{ de?: string, en?: string, it?: string }";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function pruneLocalizedText(
  map: LocalizedText | null | undefined,
): LocalizedText {
  if (!map || typeof map !== "object") {
    return {};
  }

  const out: LocalizedText = {};
  for (const locale of locales) {
    const raw = map[locale];
    if (typeof raw !== "string") {
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      out[locale] = trimmed;
    }
  }
  return out;
}

export function pickLocalizedText(
  map: LocalizedText | null | undefined,
  locale: Locale,
  fallbackLocale: Locale = defaultLocale,
): string | null {
  const pick = (key: Locale) => {
    const value = map?.[key];
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  return (
    pick(locale) ??
    pick(fallbackLocale) ??
    pick(defaultLocale) ??
    locales.map(pick).find((value) => value != null) ??
    null
  );
}
