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
