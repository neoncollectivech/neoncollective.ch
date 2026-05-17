import type { Metadata } from "next";

import { EventsIndexClient } from "@/components/events-index-client";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;

  const titles: Record<string, string> = {
    de: "Events",
    en: "Events",
    it: "Eventi",
  };

  return {
    title: titles[locale] ?? "Events",
    description: "Upcoming NEON events — browse and register.",
  };
}

export default async function EventsIndexPage() {
  return (
    <article className="py-16 md:py-28 px-6">
      <div className="max-w-3xl mx-auto">
        <EventsIndexClient />
      </div>
    </article>
  );
}
