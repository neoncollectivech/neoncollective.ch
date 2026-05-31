"use client";

import { useState } from "react";
import clsx from "clsx";

import { NeonCard, NeonCardBody } from "@/components/neon-card";
import { EventImageLightbox } from "@/components/event/event-image-lightbox";
import { ResponsiveEventImage } from "@/components/responsive-event-image";

type EventPosterHeroProps = {
  url: string;
  alt: string;
  viewFullPosterLabel: string;
  lightboxCloseLabel: string;
  className?: string;
};

export function EventPosterHero({
  url,
  alt,
  viewFullPosterLabel,
  lightboxCloseLabel,
  className,
}: EventPosterHeroProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <NeonCard
        isPressable
        aria-label={viewFullPosterLabel}
        className={clsx(
          "overflow-hidden transition-all duration-300 hover:border-neon/20",
          className,
        )}
        surface="default"
        onPress={() => setIsOpen(true)}
      >
        <NeonCardBody className="flex justify-center" padding="none">
          <ResponsiveEventImage
            alt={alt}
            className="max-h-[min(45vh,20rem)] lg:max-h-72 w-auto max-w-full object-contain"
            loading="eager"
            sizes="(max-width: 768px) 90vw, 20rem"
            url={url}
          />
        </NeonCardBody>
      </NeonCard>

      <EventImageLightbox
        alt={alt}
        ariaLabel={lightboxCloseLabel}
        isOpen={isOpen}
        url={url}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
