"use client";

import { useState } from "react";
import { Card, CardBody } from "@heroui/card";
import clsx from "clsx";

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
      <Card
        isPressable
        aria-label={viewFullPosterLabel}
        className={clsx(
          "border border-foreground/10 bg-foreground/2 overflow-hidden",
          "transition-all duration-300 hover:border-neon/20",
          className,
        )}
        radius="sm"
        onPress={() => setIsOpen(true)}
      >
        <CardBody className="p-0 flex justify-center">
          <ResponsiveEventImage
            alt={alt}
            className="max-h-[min(45vh,20rem)] lg:max-h-72 w-auto max-w-full object-contain"
            loading="eager"
            sizes="(max-width: 768px) 90vw, 20rem"
            url={url}
          />
        </CardBody>
      </Card>

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
