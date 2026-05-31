import type { ReactNode } from "react";

import clsx from "clsx";

type NeonTextButtonProps = {
  children: ReactNode;
  className?: string;
  showArrow?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  "data-testid"?: string;
};

export function NeonTextButton({
  children,
  className,
  showArrow = false,
  type = "button",
  onClick,
  disabled,
  "data-testid": dataTestId,
}: NeonTextButtonProps) {
  return (
    <button
      className={clsx("neon-text-action", className)}
      data-testid={dataTestId}
      disabled={disabled}
      type={type}
      onClick={onClick}
    >
      {children}
      {showArrow ? " →" : null}
    </button>
  );
}
