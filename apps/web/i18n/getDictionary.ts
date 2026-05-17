import type { Locale } from "./config";

const dictionaries = {
  de: () => import("@/messages/de.json").then((m) => m.default),
  en: () => import("@/messages/en.json").then((m) => m.default),
};

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["de"]>>;

export const getDictionary = (locale: Locale): Promise<Dictionary> =>
  dictionaries[locale]();
