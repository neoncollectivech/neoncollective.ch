import type { ListMeta, ListResponse } from "@/lib/api-client";
import type { AdminColumnDef } from "@/components/admin-data-table/types";
import type { AdminListServiceDefinition } from "@/lib/admin-list-services";
import type {
  ForeignKeyScope,
  ForeignKeySourceRow,
} from "@/lib/admin-fk-services";
import type { AdminSortDirection } from "@/lib/admin-list-sort";

import {
  getCoreRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  extractFkServicesFromColumns,
  extractIdKeysByFkId,
} from "@/components/admin-data-table/extract-fk-services";
import { useAdminListState } from "@/hooks/use-admin-list-state";
import { useForeignKey } from "@/hooks/use-foreign-key";
import { limitSkipToPage } from "@/lib/admin-list";

function selectionSetsEqual(
  current: readonly string[] | Set<string>,
  next: Set<string>,
): boolean {
  const currentSet =
    current instanceof Set ? current : new Set<string>(current);

  if (currentSet.size !== next.size) {
    return false;
  }

  for (const id of currentSet) {
    if (!next.has(id)) {
      return false;
    }
  }

  return true;
}

export type AdminDataTableRowSelection<TRow> = {
  getRowId: (row: TRow) => string;
  isRowSelectable?: (row: TRow) => boolean;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
};

export type AdminDataTableContext<TRow> = {
  items: TRow[];
  meta: ListMeta | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  sortField: string;
  sortDirection: AdminSortDirection;
  setFilters: (patch: Record<string, string | undefined>) => void;
  resetPage: () => void;
  refetch: () => void;
  selectedIds: string[];
  setSelectedIds: (ids: string[] | Set<string>) => void;
  toggleRowSelected: (id: string) => void;
  fk: ReturnType<typeof useForeignKey>;
};

type UseAdminDataTableArgs<TRow, TScope, TFilters> = {
  service: AdminListServiceDefinition<TRow, TScope, TFilters>;
  columns: AdminColumnDef<TRow>[];
  scope?: TScope;
  filters?: TFilters;
  fkScope?: ForeignKeyScope;
  enabled?: boolean;
  rowSelection?: AdminDataTableRowSelection<TRow>;
};

export function useAdminDataTable<
  TRow,
  TScope = undefined,
  TFilters = undefined,
>(args: UseAdminDataTableArgs<TRow, TScope, TFilters>) {
  const list = useAdminListState({
    defaultSortField: args.service.defaultSort.field,
    defaultSortDirection: args.service.defaultSort.direction,
  });

  const [filters, setFiltersState] = useState<TFilters>(
    () => (args.filters ?? {}) as TFilters,
  );

  useEffect(() => {
    setFiltersState((args.filters ?? {}) as TFilters);
  }, [args.filters]);

  const query = useQuery(
    args.service.listQuery({
      page: list.page,
      pageSize: list.pageSize,
      sort: list.sort,
      scope: args.scope,
      filters,
    }),
  );

  const listData = query.data as ListResponse<TRow> | undefined;
  const items = listData?.items ?? [];
  const meta = listData?.meta;

  const fkServices = useMemo(
    () => extractFkServicesFromColumns(args.columns),
    [args.columns],
  );
  const idKeysByFkId = useMemo(
    () => extractIdKeysByFkId(args.columns),
    [args.columns],
  );

  const fk = useForeignKey({
    rows: items as ForeignKeySourceRow[],
    load: fkServices,
    scope: args.fkScope,
    idKeysByFkId,
  });

  const [uncontrolledSelected, setUncontrolledSelected] = useState(
    () => new Set<string>(),
  );

  const rowSelectionRef = useRef(args.rowSelection);

  rowSelectionRef.current = args.rowSelection;

  const selectedSet = useMemo(() => {
    if (rowSelectionRef.current?.selectedIds) {
      return new Set(rowSelectionRef.current.selectedIds);
    }

    return uncontrolledSelected;
  }, [args.rowSelection?.selectedIds, uncontrolledSelected]);

  const setSelectedIds = useCallback((ids: string[] | Set<string>) => {
    const next = ids instanceof Set ? ids : new Set(ids);
    const rowSelection = rowSelectionRef.current;

    if (rowSelection?.onSelectedIdsChange) {
      const current = rowSelection.selectedIds ?? [];

      if (selectionSetsEqual(current, next)) {
        return;
      }

      rowSelection.onSelectedIdsChange([...next]);

      return;
    }

    setUncontrolledSelected((prev) => {
      if (selectionSetsEqual(prev, next)) {
        return prev;
      }

      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, [setSelectedIds]);

  useEffect(() => {
    clearSelection();
  }, [list.page, list.sort, filters, clearSelection]);

  const toggleRowSelected = useCallback(
    (id: string) => {
      const next = new Set(selectedSet);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      setSelectedIds(next);
    },
    [selectedSet, setSelectedIds],
  );

  const selectableIdsOnPage = useMemo(() => {
    if (!args.rowSelection) {
      return [] as string[];
    }

    return items
      .filter((row) => args.rowSelection!.isRowSelectable?.(row) ?? true)
      .map((row) => args.rowSelection!.getRowId(row));
  }, [args.rowSelection, items]);

  const allSelectableSelected =
    selectableIdsOnPage.length > 0 &&
    selectableIdsOnPage.every((id) => selectedSet.has(id));

  const toggleAllOnPage = useCallback(() => {
    const next = new Set(selectedSet);

    if (allSelectableSelected) {
      for (const id of selectableIdsOnPage) {
        next.delete(id);
      }
    } else {
      for (const id of selectableIdsOnPage) {
        next.add(id);
      }
    }
    setSelectedIds(next);
  }, [allSelectableSelected, selectableIdsOnPage, selectedSet, setSelectedIds]);

  const setFilters = useCallback(
    (patch: Record<string, string | undefined>) => {
      setFiltersState((prev) => {
        const next = { ...(prev as object), ...patch } as TFilters;

        for (const key of Object.keys(patch)) {
          if (patch[key] === undefined) {
            delete (next as Record<string, unknown>)[key];
          }
        }

        return next;
      });
      list.resetPage();
      clearSelection();
    },
    [list, clearSelection],
  );

  const sortingState: SortingState = useMemo(
    () => [{ id: list.sortField, desc: list.sortDirection === "desc" }],
    [list.sortField, list.sortDirection],
  );

  const { totalPages } = limitSkipToPage(
    meta ?? { limit: list.pageSize, skip: 0, total: 0 },
  );

  const selectionMeta = args.rowSelection
    ? {
        getRowId: args.rowSelection.getRowId,
        isRowSelectable: args.rowSelection.isRowSelectable,
        selectedIds: selectedSet,
        toggleRow: toggleRowSelected,
        toggleAllOnPage,
        allSelectableSelected,
        selectableIdsOnPage,
      }
    : undefined;

  const table = useReactTable({
    data: items,
    columns: args.columns,
    pageCount: totalPages,
    state: {
      sorting: sortingState,
      pagination: {
        pageIndex: Math.max(0, list.page - 1),
        pageSize: list.pageSize,
      },
    },
    onSortingChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(sortingState) : updater;
      const first = next[0];

      if (!first) {
        return;
      }

      list.toggleSort(first.id);
    },
    onPaginationChange: () => {
      /* pagination driven by AdminListPagination + useAdminListState */
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableMultiSort: false,
    meta: {
      fk,
      selection: selectionMeta,
    },
  });

  const ctx: AdminDataTableContext<TRow> = {
    items,
    meta,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ?? null,
    page: list.page,
    pageSize: list.pageSize,
    setPage: list.setPage,
    setPageSize: list.setPageSize,
    sortField: list.sortField,
    sortDirection: list.sortDirection,
    setFilters,
    resetPage: list.resetPage,
    refetch: () => void query.refetch(),
    selectedIds: [...selectedSet],
    setSelectedIds,
    toggleRowSelected,
    fk,
  };

  return {
    table,
    ctx,
    list,
    query,
    enabled: args.enabled !== false,
  };
}
