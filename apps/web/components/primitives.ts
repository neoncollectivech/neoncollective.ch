import { tv } from "tailwind-variants";

export const title = tv({
  base: "tracking-tight inline font-semibold",
  variants: {
    color: {
      neon: "text-neon",
      foreground: "text-foreground",
      muted: "text-foreground/50",
    },
    size: {
      sm: "text-md lg:text-lg",
      md: "text-lg lg:text-2xl leading-9",
      lg: "text-2xl lg:text-4xl",
      xl: "text-4xl lg:text-6xl",
    },
    fullWidth: {
      true: "w-full block",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export const subtitle = tv({
  base: "w-full md:w-1/2 my-2 text-lg lg:text-xl text-foreground/40 block max-w-full font-light",
  variants: {
    fullWidth: {
      true: "!w-full",
    },
  },
  defaultVariants: {
    fullWidth: true,
  },
});
