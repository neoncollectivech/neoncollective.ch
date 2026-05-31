import { Spinner } from "@heroui/react";
import clsx from "clsx";

type PageSpinnerProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function PageSpinner({ className, size = "lg" }: PageSpinnerProps) {
  return (
    <div className={clsx("flex justify-center py-16", className)}>
      <Spinner color="success" size={size} />
    </div>
  );
}
