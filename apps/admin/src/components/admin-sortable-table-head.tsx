import type { AdminSortDirection } from "@/lib/admin-list-sort";

import { AdminSortableColumnLabel } from "@/components/admin-sortable-column-label";
import { TableHead } from "@/components/ui/table";

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

  return (
    <TableHead className={className}>
      <AdminSortableColumnLabel
        active={active}
        direction={active ? sortDirection : undefined}
        label={label}
        onClick={() => onSort(field)}
      />
    </TableHead>
  );
}
