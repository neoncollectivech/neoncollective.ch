import { Button, ButtonProps } from "@heroui/button";
import clsx from "clsx";

const base =
  "font-mono text-xs uppercase tracking-widest transition-all duration-300";
const neon = "border-neon/60 text-neon hover:bg-neon/10 hover:border-neon";

export function NeonButton({
  className,
  variant = "bordered",
  radius = "none",
  isDisabled,
  ...props
}: ButtonProps) {
  return (
    <Button
      className={clsx(base, !isDisabled && neon, className)}
      isDisabled={isDisabled}
      radius={radius}
      variant={variant}
      {...props}
    />
  );
}
