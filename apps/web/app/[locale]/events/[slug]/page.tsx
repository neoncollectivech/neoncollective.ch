import type { Metadata } from "next";

import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { EventDetailsClient } from "@/components/event-details";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

function eventSlugList(): string[] {
  const raw = process.env.NEXT_PUBLIC_EVENT_SLUGS?.trim();
  const parsed = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Never return [] — empty env or `NEXT_PUBLIC_EVENT_SLUGS=` breaks `output: "export"`.
  if (parsed.length > 0) {
    return parsed;
  }

  return ["demo"];
}

/**
 * With `output: "export"`, pre-built event pages come from `NEXT_PUBLIC_EVENT_SLUGS` (public
 * events only). Invite-only dossiers use `/events/private?slug=…` so they do not need a
 * static `[slug]` entry.
 */
export function generateStaticParams(): { locale: string; slug: string }[] {
  const slugs = eventSlugList();
  const out: { locale: string; slug: string }[] = [];

  for (const locale of locales) {
    for (const slug of slugs) {
      out.push({ locale, slug });
    }
  }

  return out;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const dictionary = await getDictionary(locale as Locale);

  return {
    title: `Event — ${slug}`,
    description: dictionary.meta.eventDetailDescription,
  };
}

export default async function EventPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <article className="py-16 md:py-28 px-6">
      <div className="max-w-3xl lg:max-w-5xl mx-auto">
        <EventDetailsClient slug={slug} />
      </div>
    </article>
  );
}
