import { useCallback, useMemo, useState } from "react";

import { DEFAULT_ADMIN_PAGE_SIZE } from "@/lib/admin-list";
import {
  toAdminSortParam,
  type AdminSortDirection,
} from "@/lib/admin-list-sort";

export type UseAdminListStateOptions = {
  /** Server sort field (camelCase column name). */
  defaultSortField: string;
  defaultSortDirection?: AdminSortDirection;
  initialPageSize?: number;
};

export function useAdminListState(options: UseAdminListStateOptions) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(
    options.initialPageSize ?? DEFAULT_ADMIN_PAGE_SIZE,
  );
  const [sortField, setSortField] = useState(options.defaultSortField);
  const [sortDirection, setSortDirection] = useState<AdminSortDirection>(
    options.defaultSortDirection ?? "asc",
  );

  const sort = useMemo(
    () => toAdminSortParam(sortField, sortDirection),
    [sortField, sortDirection],
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const resetPage = useCallback(() => {
    setPage(1);
  }, []);

  const toggleSort = useCallback((field: string) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));

        return prev;
      }
      setSortDirection("asc");

      return field;
    });
    setPage(1);
  }, []);

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    resetPage,
    sort,
    sortField,
    sortDirection,
    toggleSort,
  };
}
