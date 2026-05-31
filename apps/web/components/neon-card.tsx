import type { ComponentProps } from "react";

import { Card, CardBody, type CardProps } from "@heroui/card";
import clsx from "clsx";
import { tv, type VariantProps } from "tailwind-variants";

import { neonPanelBodyPaddingClass } from "@/config/modal-chrome";

const neonCard = tv({
  base: "neon-surface shadow-none bg-background w-full min-w-0 max-w-full",
  variants: {
    surface: {
      default: "neon-surface-default",
      accent: "neon-surface-accent",
      none: "",
    },
  },
  defaultVariants: {
    surface: "default",
  },
});

const neonCardBody = tv({
  base: "min-w-0 w-full overflow-x-clip",
  variants: {
    padding: {
      // Must be Tailwind utilities (not @layer components) so twMerge overrides HeroUI CardBody p-3.
      default: "px-8 py-10 sm:px-10",
      session: "px-8 py-8 sm:px-10",
      checkout: neonPanelBodyPaddingClass,
      compact: "px-3 py-2.5",
      none: "p-0",
    },
  },
  defaultVariants: {
    padding: "default",
  },
});

export type NeonCardProps = CardProps &
  VariantProps<typeof neonCard> & {
    bodyPadding?: VariantProps<typeof neonCardBody>["padding"];
  };

export function NeonCard({
  surface,
  className,
  radius = "none",
  ...props
}: NeonCardProps) {
  return (
    <Card
      className={neonCard({ surface, className })}
      radius={radius}
      {...props}
    />
  );
}

export type NeonCardBodyProps = ComponentProps<typeof CardBody> &
  VariantProps<typeof neonCardBody>;

export function NeonCardBody({
  padding,
  className,
  ...props
}: NeonCardBodyProps) {
  return (
    <CardBody className={neonCardBody({ padding, className })} {...props} />
  );
}

export function neonSurfaceBoxClass(
  surface: "default" | "accent" = "default",
  compact = false,
): string {
  return clsx(
    surface === "accent" ? "neon-surface-accent" : "neon-surface-default",
    compact ? "neon-surface-compact" : undefined,
  );
}
