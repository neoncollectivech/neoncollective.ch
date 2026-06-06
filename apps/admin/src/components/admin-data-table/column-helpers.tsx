import type { ReactNode } from "react";
import type { CellContext, ColumnDef } from "@tanstack/react-table";
import type {
  AdminColumnDef,
  AdminDataTableMeta,
} from "@/components/admin-data-table/types";
import type { AdminFkServiceDefinition } from "@/lib/admin-fk-services";

import { Link } from "react-router-dom";

import { AdminFkCell } from "@/components/admin-fk/admin-fk-cell";
import { DataTableColumnHeader } from "@/components/admin-data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  adminTableLinkClass,
  adminTableLinkClassName,
} from "@/lib/admin-table-link";

export { adminTableLinkClassName as adminDetailLinkClassName };

export function AdminDetailLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link className={adminTableLinkClass(className)} to={href}>
      {children}
    </Link>
  );
}

export function adminLinkColumn<TRow>(opts: {
  id: string;
  accessorKey?: keyof TRow & string;
  header: string;
  sortable?: boolean;
  className?: string;
  getHref: (row: TRow) => string | undefined;
  getLabel: (row: TRow) => string;
}): AdminColumnDef<TRow> {
  return {
    id: opts.id,
    accessorKey: opts.accessorKey,
    header: opts.sortable ? createSortHeader(opts.header) : opts.header,
    enableSorting: Boolean(opts.sortable),
    meta: { sortable: opts.sortable },
    cell: ({ row }) => {
      const label = opts.getLabel(row.original);
      const href = opts.getHref(row.original);

      if (!href || !label) {
        return (
          <span className={opts.className ?? "text-muted-foreground"}>
            {label || "—"}
          </span>
        );
      }

      return (
        <AdminDetailLink className={opts.className} href={href}>
          {label}
        </AdminDetailLink>
      );
    },
  };
}

function createSortHeader<TRow, TValue>(
  title: string,
): NonNullable<ColumnDef<TRow, TValue>["header"]> {
  function SortHeader({
    column,
  }: {
    column: import("@tanstack/react-table").Column<TRow, TValue>;
  }) {
    return <DataTableColumnHeader column={column} title={title} />;
  }

  SortHeader.displayName = `SortHeader(${title})`;

  return SortHeader;
}

function getMeta<TRow>(ctx: CellContext<TRow, unknown>) {
  return ctx.table.options.meta as AdminDataTableMeta<TRow> | undefined;
}

export function adminTextColumn<TRow>(
  accessorKey: keyof TRow & string,
  opts: { header: string; sortable?: boolean; className?: string },
): AdminColumnDef<TRow> {
  return {
    accessorKey,
    id: accessorKey,
    header: opts.sortable ? createSortHeader(opts.header) : opts.header,
    enableSorting: Boolean(opts.sortable),
    meta: { sortable: opts.sortable },
    cell: ({ row }) => {
      const value = row.getValue(accessorKey);

      return (
        <span className={opts.className}>
          {value != null && value !== "" ? String(value) : "—"}
        </span>
      );
    },
  };
}

export function adminDateColumn<TRow>(
  accessorKey: keyof TRow & string,
  opts: { header: string; sortable?: boolean },
): AdminColumnDef<TRow> {
  return {
    accessorKey,
    id: accessorKey,
    header: opts.sortable ? createSortHeader(opts.header) : opts.header,
    enableSorting: Boolean(opts.sortable),
    meta: { sortable: opts.sortable },
    cell: ({ row }) => {
      const raw = row.getValue(accessorKey);

      if (typeof raw !== "string" || !raw) {
        return <span className="text-muted-foreground">—</span>;
      }

      return (
        <span className="whitespace-nowrap text-muted-foreground">
          {new Date(raw).toLocaleString()}
        </span>
      );
    },
  };
}

export function adminMoneyColumn<TRow>(
  accessorKey: keyof TRow & string,
  opts: { header: string; sortable?: boolean },
): AdminColumnDef<TRow> {
  return {
    accessorKey,
    id: accessorKey,
    header: opts.sortable ? createSortHeader(opts.header) : opts.header,
    enableSorting: Boolean(opts.sortable),
    meta: { sortable: opts.sortable },
    cell: ({ row }) => {
      const cents = row.getValue(accessorKey);

      if (typeof cents !== "number") {
        return "—";
      }

      return <>CHF {(cents / 100).toFixed(2)}</>;
    },
  };
}

export function adminBadgeColumn<TRow>(
  accessorKey: keyof TRow & string,
  opts: {
    header: string;
    sortable?: boolean;
    variant?: (value: unknown, row: TRow) => "default" | "secondary";
  },
): AdminColumnDef<TRow> {
  return {
    accessorKey,
    id: accessorKey,
    header: opts.sortable ? createSortHeader(opts.header) : opts.header,
    enableSorting: Boolean(opts.sortable),
    meta: { sortable: opts.sortable },
    cell: ({ row }) => {
      const value = row.getValue(accessorKey);
      const variant = opts.variant?.(value, row.original) ?? "default";

      return (
        <Badge variant={variant === "secondary" ? "secondary" : "default"}>
          {value != null ? String(value) : "—"}
        </Badge>
      );
    },
  };
}

export function adminFkColumn<TRow extends Record<string, unknown>>(
  idKey: keyof TRow & string,
  opts: {
    header: string;
    fk: AdminFkServiceDefinition;
    display: string | readonly string[];
    sortable?: boolean;
    href?: (row: TRow) => string | undefined;
  },
): AdminColumnDef<TRow> {
  return {
    id: `fk-${opts.fk.id}-${String(idKey)}-${opts.header.replace(/\s+/g, "-").toLowerCase()}`,
    accessorKey: idKey,
    header: opts.sortable ? createSortHeader(opts.header) : opts.header,
    enableSorting: Boolean(opts.sortable),
    meta: {
      sortable: opts.sortable ?? false,
      fk: {
        fk: opts.fk,
        idKey,
        display: opts.display,
      },
    },
    cell: (ctx) => {
      const meta = getMeta(ctx);
      const foreignId = ctx.row.original[idKey];

      if (!meta?.fk) {
        return <span className="text-muted-foreground">—</span>;
      }

      return (
        <AdminFkCell
          fk={meta.fk}
          fkService={opts.fk}
          foreignDisplayField={opts.display}
          foreignId={
            typeof foreignId === "string"
              ? foreignId
              : foreignId == null
                ? null
                : String(foreignId)
          }
          href={opts.href ? () => opts.href!(ctx.row.original) : undefined}
        />
      );
    },
  };
}

export function adminSelectionColumn<TRow>(opts?: {
  idPrefix?: string;
}): AdminColumnDef<TRow> {
  const idPrefix = opts?.idPrefix ?? "admin-table-row";

  return {
    id: "select",
    header: ({ table }) => {
      const meta = table.options.meta as AdminDataTableMeta<TRow> | undefined;
      const sel = meta?.selection;

      if (!sel) {
        return null;
      }

      const selectAllId = `${idPrefix}-select-all`;

      return (
        <Checkbox
          aria-label="Select all selectable rows on this page"
          checked={sel.allSelectableSelected}
          disabled={sel.selectableIdsOnPage.length === 0}
          id={selectAllId}
          onCheckedChange={() => sel.toggleAllOnPage()}
        />
      );
    },
    cell: ({ row, table }) => {
      const meta = table.options.meta as AdminDataTableMeta<TRow> | undefined;
      const sel = meta?.selection;

      if (!sel) {
        return null;
      }

      const id = sel.getRowId(row.original);
      const canSelect = sel.isRowSelectable?.(row.original) ?? true;
      const checkboxId = `${idPrefix}-${id}`;

      return (
        <Checkbox
          aria-label="Select row"
          checked={sel.selectedIds.has(id)}
          disabled={!canSelect}
          id={checkboxId}
          onCheckedChange={() => sel.toggleRow(id)}
        />
      );
    },
    enableSorting: false,
  };
}

export function adminActionsColumn<TRow>(opts: {
  cell: ColumnDef<TRow, unknown>["cell"];
}): AdminColumnDef<TRow> {
  return {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: opts.cell,
  };
}
