"use client";

import { EventImageGallery } from "@/components/event-image-gallery";

type EventAboutSectionProps = {
  summary: string | null;
  imageUrls: string[];
  imageAlt: string;
  className?: string;
};

export function EventAboutSection({
  summary,
  imageUrls,
  imageAlt,
  className,
}: EventAboutSectionProps) {
  const summaryLine = summary?.trim();
  const gallery = imageUrls.length > 1 ? imageUrls.slice(1) : [];

  if (!summaryLine && gallery.length === 0) {
    return null;
  }

  return (
    <section className={className}>
      {summaryLine ? (
        <p className="neon-body whitespace-pre-wrap">{summaryLine}</p>
      ) : null}
      {gallery.length > 0 ? (
        <EventImageGallery
          className={summaryLine ? "mt-6" : undefined}
          imageAlt={imageAlt}
          urls={gallery}
        />
      ) : null}
    </section>
  );
}
