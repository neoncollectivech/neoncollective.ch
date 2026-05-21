import { useCallback, useState } from "react";

import { DEFAULT_ADMIN_PAGE_SIZE } from "@/lib/admin-list";

export function useAdminListPagination(
  initialPageSize = DEFAULT_ADMIN_PAGE_SIZE,
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const resetPage = useCallback(() => {
    setPage(1);
  }, []);

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    resetPage,
  };
}
