import type { Column } from "@tanstack/react-table";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DataTableColumnHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
};

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span className={className}>{title}</span>;
  }

  const sorted = column.getIsSorted();
  const Icon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <Button
      className={cn(
        "inline-flex h-auto items-center gap-1 p-0 font-medium hover:bg-transparent",
        sorted ? "text-foreground" : "text-muted-foreground",
        className,
      )}
      type="button"
      variant="ghost"
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {title}
      <Icon aria-hidden className="size-3.5 shrink-0 opacity-70" />
    </Button>
  );
}
