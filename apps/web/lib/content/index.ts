import type { Locale } from "@/i18n/config";
import type { ContentMap } from "./types";

/**
 * Fetch page content for a given slug and locale.
 *
 * Currently reads from local TypeScript files.
 * When Strapi is integrated, only this function body changes:
 *
 *   const res = await fetch(`${STRAPI_URL}/api/${slug}?locale=${locale}`);
 *   return res.json();
 */
export async function getContent<K extends keyof ContentMap>(
  slug: K,
  locale: Locale,
): Promise<ContentMap[K]> {
  const mod = await import(`./local/${slug}`);

  return mod.default[locale] as ContentMap[K];
}
