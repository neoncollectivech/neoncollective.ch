/** Shared content inset: HeroUI ModalBody defaults to px-6 py-2; CardBody to p-3. */
export const neonPanelBodyPaddingClass = "px-6 py-8";

/** Inset for nested bordered rows inside a panel (e.g. checkout tier cards). */
export const neonPanelInsetPaddingClass = "p-4";

/** Shared HeroUI modal panel chrome (sharp corners, subtle border). */
export const neonModalClassName =
  "bg-background border border-foreground/10 rounded-none";

/** Dim + light blur; blur omitted when user prefers reduced motion. */
export const neonModalBackdropClass =
  "bg-black/60 motion-safe:backdrop-blur-sm";

export const neonModalClassNames = {
  backdrop: neonModalBackdropClass,
} as const;

/** Backdrop + classNames applied to every site modal. */
export const neonModalChrome = {
  backdrop: "blur" as const,
  classNames: neonModalClassNames,
};
