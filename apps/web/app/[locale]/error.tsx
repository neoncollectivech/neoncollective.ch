"use client";

import { useEffect } from "react";

import { NeonHero } from "@/components/neon-hero";
import { NeonButton } from "@/components/neon-button";
import { useDictionary } from "@/i18n/DictionaryContext";

const messages = {
  de: {
    subtitle: "Signal unterbrochen",
    description: "Etwas ist schiefgelaufen.",
    retry: "Erneut versuchen",
  },
  en: {
    subtitle: "Signal interrupted",
    description: "Something went wrong.",
    retry: "Try again",
  },
} as const;

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  let locale: "de" | "en" = "de";

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ctx = useDictionary();

    locale = ctx.locale;
  } catch {
    // DictionaryProvider may not be available if layout itself errored
  }

  const t = messages[locale];

  useEffect(() => {
    /* eslint-disable no-console */
    console.error(error);
  }, [error]);

  return (
    <NeonHero description={t.description} subtitle={t.subtitle} title="500">
      <div className="neon-line w-12 mt-10" />
      <NeonButton className="mt-10" onPress={() => reset()}>
        {t.retry}
      </NeonButton>
    </NeonHero>
  );
}
