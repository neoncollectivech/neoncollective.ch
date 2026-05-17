import type { Locale } from "@/i18n/config";

function localeTag(locale: Locale): string {
  if (locale === "de") {
    return "de-CH";
  }
  if (locale === "it") {
    return "it-CH";
  }

  return "en-GB";
}

export function formatLocaleDateTime(
  iso: string,
  locale: Locale,
  opts?: { dateStyle?: "short" | "medium" | "long"; timeStyle?: "short" },
): string {
  return new Date(iso).toLocaleString(localeTag(locale), {
    dateStyle: opts?.dateStyle ?? "medium",
    timeStyle: opts?.timeStyle ?? "short",
  });
}

export function formatLocaleDate(iso: string, locale: Locale): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(localeTag(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
