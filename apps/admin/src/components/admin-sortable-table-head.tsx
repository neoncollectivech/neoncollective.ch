import type { AdminSortDirection } from "@/lib/admin-list-sort";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type AdminSortableTableHeadProps = {
  label: string;
  field: string;
  sortField: string;
  sortDirection: AdminSortDirection;
  onSort: (field: string) => void;
  className?: string;
  sortable?: boolean;
};

export function AdminSortableTableHead({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
  className,
  sortable = true,
}: AdminSortableTableHeadProps) {
  if (!sortable) {
    return <TableHead className={className}>{label}</TableHead>;
  }

  const active = sortField === field;
  const Icon = active
    ? sortDirection === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <TableHead className={className}>
      <Button
        className={cn(
          "inline-flex h-auto items-center gap-1 p-0 font-medium hover:bg-transparent",
          active ? "text-foreground" : "text-muted-foreground",
        )}
        type="button"
        variant="ghost"
        onClick={() => onSort(field)}
      >
        {label}
        <Icon aria-hidden className="size-3.5 shrink-0 opacity-70" />
      </Button>
    </TableHead>
  );
}
