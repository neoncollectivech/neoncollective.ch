"use client";

import NextLink from "next/link";

import { NeonHero } from "@/components/neon-hero";
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
} as const;

export default function NotFound() {
  const { locale } = useDictionary();
  const t = messages[locale];

  return (
    <NeonHero description={t.description} subtitle={t.subtitle} title="404">
      <div className="neon-line w-12 mt-10" />
      <NextLink
        className="mt-10 inline-block border border-neon/60 px-8 py-3 text-xs font-mono uppercase tracking-widest text-neon leading-none hover:bg-neon/10 hover:border-neon no-underline transition-all duration-300"
        href={`/${locale}`}
      >
        {t.home}
      </NextLink>
    </NeonHero>
  );
}
