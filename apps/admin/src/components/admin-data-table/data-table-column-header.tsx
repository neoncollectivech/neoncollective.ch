import type { Column } from "@tanstack/react-table";

import { AdminSortableColumnLabel } from "@/components/admin-sortable-column-label";

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

  return (
    <AdminSortableColumnLabel
      active={sorted === "asc" || sorted === "desc"}
      className={className}
      direction={
        sorted === "asc" ? "asc" : sorted === "desc" ? "desc" : undefined
      }
      label={title}
      onClick={() => column.toggleSorting(sorted === "asc")}
    />
  );
}
