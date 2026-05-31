import type { Metadata } from "next";

import { EventsIndexClient } from "@/components/events-index-client";
import { PageShell } from "@/components/page-shell";

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
    <PageShell width="eventList">
      <EventsIndexClient />
    </PageShell>
  );
}
