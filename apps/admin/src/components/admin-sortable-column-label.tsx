import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminSortableColumnLabelProps = {
  label: string;
  active: boolean;
  direction?: "asc" | "desc";
  className?: string;
  onClick: () => void;
};

export function AdminSortableColumnLabel({
  label,
  active,
  direction,
  className,
  onClick,
}: AdminSortableColumnLabelProps) {
  const Icon =
    active && direction === "asc"
      ? ArrowUp
      : active && direction === "desc"
        ? ArrowDown
        : ArrowUpDown;

  return (
    <Button
      className={cn(
        "inline-flex h-auto items-center gap-1 p-0 font-medium hover:bg-transparent",
        active ? "text-foreground" : "text-muted-foreground",
        className,
      )}
      type="button"
      variant="ghost"
      onClick={onClick}
    >
      {label}
      <Icon aria-hidden className="size-3.5 shrink-0 opacity-70" />
    </Button>
  );
}
