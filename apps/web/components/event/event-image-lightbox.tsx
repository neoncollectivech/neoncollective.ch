"use client";

import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";

import { ResponsiveEventImage } from "@/components/responsive-event-image";
import { neonModalChrome, neonModalClassName } from "@/config/modal-chrome";

type EventImageLightboxProps = {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  alt: string;
  ariaLabel: string;
  header?: string;
};

export function EventImageLightbox({
  isOpen,
  onClose,
  url,
  alt,
  ariaLabel,
  header,
}: EventImageLightboxProps) {
  return (
    <Modal
      {...neonModalChrome}
      isDismissable
      aria-label={ariaLabel}
      isOpen={isOpen}
      placement="center"
      scrollBehavior="inside"
      size="3xl"
      onClose={onClose}
    >
      <ModalContent className={neonModalClassName}>
        {header ? (
          <ModalHeader className="border-b border-foreground/10">
            <span className="text-sm font-mono uppercase tracking-widest text-foreground/50">
              {header}
            </span>
          </ModalHeader>
        ) : null}
        <ModalBody className="flex items-center justify-center py-8">
          <ResponsiveEventImage
            alt={alt}
            className="max-h-[min(85vh,720px)] w-auto max-w-full object-contain"
            loading="eager"
            sizes="(max-width: 768px) 100vw, 56rem"
            url={url}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
