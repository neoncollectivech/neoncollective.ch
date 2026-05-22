import type { AdminSortDirection } from "@/lib/admin-list-sort";

import { useCallback, useMemo, useState } from "react";

import { compareSortValues } from "@/lib/admin-list-sort";

export type UseClientTableSortOptions<TRow> = {
  defaultField: string;
  defaultDirection?: AdminSortDirection;
  getValue?: (
    row: TRow,
    field: string,
  ) => string | number | boolean | null | undefined;
};

export function useClientTableSort<TRow>(
  rows: readonly TRow[],
  options: UseClientTableSortOptions<TRow>,
) {
  const [sortField, setSortField] = useState(options.defaultField);
  const [sortDirection, setSortDirection] = useState<AdminSortDirection>(
    options.defaultDirection ?? "asc",
  );

  const getValue =
    options.getValue ??
    ((row: TRow, field: string) =>
      (row as Record<string, unknown>)[field] as
        | string
        | number
        | boolean
        | null
        | undefined);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    const dir = sortDirection === "asc" ? 1 : -1;

    copy.sort((a, b) => {
      const cmp = compareSortValues(
        getValue(a, sortField),
        getValue(b, sortField),
      );

      return cmp * dir;
    });

    return copy;
  }, [rows, sortField, sortDirection, getValue]);

  const toggleSort = useCallback((field: string) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));

        return prev;
      }
      setSortDirection("asc");

      return field;
    });
  }, []);

  return {
    rows: sortedRows,
    sortField,
    sortDirection,
    toggleSort,
  };
}
