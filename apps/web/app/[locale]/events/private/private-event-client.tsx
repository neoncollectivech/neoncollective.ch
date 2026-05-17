"use client";

import { useSearchParams } from "next/navigation";

import { EventDetailsClient } from "@/components/event-details";
import { NeonLink } from "@/components/neon-link";
import { useDictionary } from "@/i18n/DictionaryContext";
import { useLocale } from "@/hooks/use-locale";

export function PrivateEventClient() {
  const searchParams = useSearchParams();
  const { dictionary } = useDictionary();
  const locale = useLocale();
  const slug = searchParams.get("slug")?.trim() ?? "";
  const t = dictionary.events;

  if (!slug) {
    return (
      <div className="space-y-3 text-sm text-foreground/50">
        <p>{t.privateMissingSlug}</p>
        <p>
          <NeonLink href={`/${locale}/events`}>
            {t.privateBackToEvents}
          </NeonLink>
        </p>
      </div>
    );
  }

  return <EventDetailsClient slug={slug} />;
}
