"use client";

import { NeonHero } from "@/components/neon-hero";
import { NeonLink } from "@/components/neon-link";
import { useDictionary } from "@/i18n/DictionaryContext";

const messages = {
  de: {
    subtitle: "Signal verloren",
    description: "Die Frequenz, die du suchst, existiert nicht.",
    home: "Zurück",
  },
  en: {
    subtitle: "Signal lost",
    description: "The frequency you're looking for doesn't exist.",
    home: "Go back",
  },
  it: {
    subtitle: "Segnale perso",
    description: "La frequenza che cerchi non esiste.",
    home: "Torna indietro",
  },
} as const;

export default function NotFound() {
  const { locale } = useDictionary();
  const t = messages[locale];

  return (
    <NeonHero description={t.description} subtitle={t.subtitle} title="404">
      <div className="neon-line w-12 mt-10" />
      <NeonLink className="mt-10" href={`/${locale}`} neonStyle="cta">
        {t.home}
      </NeonLink>
    </NeonHero>
  );
}
