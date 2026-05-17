"use client";

import type { Locale } from "@/i18n/config";

import { useParams, useSearchParams } from "next/navigation";

import { EventDetailsClient } from "@/components/event-details";
import { NeonLink } from "@/components/neon-link";
import { useDictionary } from "@/i18n/DictionaryContext";

export function PrivateEventClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { dictionary } = useDictionary();
  const locale = params.locale as Locale;
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

  return <EventDetailsClient locale={locale} slug={slug} />;
}
