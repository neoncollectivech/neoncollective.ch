"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@heroui/card";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import clsx from "clsx";

import { NeonButton } from "@/components/neon-button";
import { ResponsiveEventImage } from "@/components/responsive-event-image";
import { useDictionary } from "@/i18n/DictionaryContext";

type EventImageGalleryProps = {
  urls: string[];
  imageAlt: string;
  className?: string;
};

export function EventImageGallery({
  urls,
  imageAlt,
  className,
}: EventImageGalleryProps) {
  const { dictionary } = useDictionary();
  const t = dictionary.events;
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const openAt = useCallback((i: number) => {
    setIndex(i);
    setIsOpen(true);
  }, []);

  const onClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(urls.length - 1, i + 1));
  }, [urls.length]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, goPrev, goNext]);

  if (urls.length === 0) {
    return null;
  }

  const showNav = urls.length > 1;
  const currentUrl = urls[index];

  if (!currentUrl) {
    return null;
  }

  const counter = t.galleryCounter
    .replace("{current}", String(index + 1))
    .replace("{total}", String(urls.length));

  return (
    <>
      <div className={clsx("grid grid-cols-2 sm:grid-cols-3 gap-2", className)}>
        {urls.map((url, i) => (
          <Card
            key={`${url}-${i}`}
            isPressable
            aria-label={t.galleryOpenImage.replace("{n}", String(i + 1))}
            className={clsx(
              "border border-foreground/10 bg-transparent overflow-hidden aspect-4/3",
              "transition-all duration-300 hover:border-neon/20",
            )}
            radius="sm"
            onPress={() => openAt(i)}
          >
            <CardBody className="p-0 overflow-hidden">
              <ResponsiveEventImage
                alt={`${imageAlt} (${i + 2})`}
                className="w-full h-full object-cover"
                loading="lazy"
                sizes="(max-width: 640px) 50vw, 33vw"
                url={url}
              />
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal
        isDismissable
        aria-label={t.galleryClose}
        isOpen={isOpen}
        placement="center"
        scrollBehavior="inside"
        size="3xl"
        onClose={onClose}
      >
        <ModalContent className="bg-background border border-foreground/10 rounded-none">
          <ModalHeader className="border-b border-foreground/10">
            <span className="text-sm font-mono uppercase tracking-widest text-foreground/50">
              {counter}
            </span>
          </ModalHeader>
          <ModalBody className="flex items-center justify-center py-8">
            <ResponsiveEventImage
              alt={`${imageAlt} (${index + 2})`}
              className="max-h-[min(85vh,720px)] w-auto max-w-full object-contain"
              loading="eager"
              sizes="(max-width: 768px) 100vw, 56rem"
              url={currentUrl}
            />
          </ModalBody>
          {showNav ? (
            <ModalFooter className="border-t border-foreground/10 justify-between">
              <NeonButton
                isDisabled={index === 0}
                variant="bordered"
                onPress={goPrev}
              >
                {t.galleryPrevious}
              </NeonButton>
              <NeonButton
                isDisabled={index === urls.length - 1}
                variant="bordered"
                onPress={goNext}
              >
                {t.galleryNext}
              </NeonButton>
            </ModalFooter>
          ) : null}
        </ModalContent>
      </Modal>
    </>
  );
}
