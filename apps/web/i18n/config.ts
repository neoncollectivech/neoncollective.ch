export const locales = ["de", "en", "it"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "de";
