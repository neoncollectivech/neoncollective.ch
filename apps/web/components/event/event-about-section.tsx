"use client";

import type { EventImage } from "@/helpers/event-image-focal";

import { EventImageGallery } from "@/components/event-image-gallery";
import { Markdown } from "@/components/markdown";

type EventAboutSectionProps = {
  summary: string | null;
  images: EventImage[];
  imageAlt: string;
  className?: string;
};

export function EventAboutSection({
  summary,
  images,
  imageAlt,
  className,
}: EventAboutSectionProps) {
  const summaryLine = summary?.trim();
  const gallery = images.length > 1 ? images.slice(1) : [];

  if (!summaryLine && gallery.length === 0) {
    return null;
  }

  return (
    <section className={className}>
      {summaryLine ? (
        <div className="neon-body">
          <Markdown content={summaryLine} />
        </div>
      ) : null}
      {gallery.length > 0 ? (
        <EventImageGallery
          className={summaryLine ? "mt-6" : undefined}
          imageAlt={imageAlt}
          images={gallery}
        />
      ) : null}
    </section>
  );
}
