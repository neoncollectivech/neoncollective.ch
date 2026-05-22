import type { ColumnDef } from "@tanstack/react-table";
import type { UseForeignKeyResult } from "@/hooks/use-foreign-key";
import type { AdminFkServiceDefinition } from "@/lib/admin-fk-services";
import type { AdminSortDirection } from "@/lib/admin-list-sort";

export type AdminColumnMeta<TRow> = {
  sortable?: boolean;
  fk?: {
    fk: AdminFkServiceDefinition;
    idKey?: keyof TRow & string;
    display: string | readonly string[];
  };
};

export type AdminColumnDef<TRow> = ColumnDef<TRow, unknown> & {
  meta?: AdminColumnMeta<TRow>;
};

export type AdminDataTableMeta<TRow> = {
  fk: UseForeignKeyResult;
  selection?: AdminDataTableSelectionMeta<TRow>;
};

export type AdminDataTableSelectionMeta<TRow> = {
  getRowId: (row: TRow) => string;
  isRowSelectable?: (row: TRow) => boolean;
  selectedIds: Set<string>;
  toggleRow: (id: string) => void;
  toggleAllOnPage: () => void;
  allSelectableSelected: boolean;
  selectableIdsOnPage: string[];
};

export type { AdminSortDirection };
