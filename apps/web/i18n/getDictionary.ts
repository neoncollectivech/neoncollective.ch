import type { Locale } from "./config";

import { cache } from "react";

const dictionaries = {
  de: () => import("@/messages/de.json").then((m) => m.default),
  en: () => import("@/messages/en.json").then((m) => m.default),
  it: () => import("@/messages/it.json").then((m) => m.default),
};

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["de"]>>;

export const getDictionary = cache(
  (locale: Locale): Promise<Dictionary> => dictionaries[locale](),
);
