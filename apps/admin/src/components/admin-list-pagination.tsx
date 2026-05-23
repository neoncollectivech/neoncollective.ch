import type { ListMeta } from "@/lib/api-client";

import { useEffect, useMemo } from "react";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import {
  ADMIN_PAGE_SIZE_OPTIONS,
  limitSkipToPage,
  listRangeLabel,
} from "@/lib/admin-list";

type AdminListPaginationProps = {
  meta: ListMeta;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  isLoading?: boolean;
  /** Unique prefix for the page-size field id/name (e.g. list service id). */
  idPrefix?: string;
};

function pageNumbers(
  current: number,
  totalPages: number,
): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([
    1,
    totalPages,
    current,
    current - 1,
    current + 1,
  ]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const prev = sorted[i - 1];

    if (i > 0 && prev !== undefined && p - prev > 1) {
      result.push("ellipsis");
    }
    result.push(p);
  }

  return result;
}

export function AdminListPagination({
  meta,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
  idPrefix = "admin-list",
}: AdminListPaginationProps) {
  const { totalPages } = limitSkipToPage(meta);
  const pageSizeFieldId = `${idPrefix}-page-size`;

  useEffect(() => {
    if (page > totalPages) {
      onPageChange(Math.max(1, totalPages));
    }
  }, [page, totalPages, onPageChange]);

  const items = useMemo(
    () => pageNumbers(page, totalPages),
    [page, totalPages],
  );

  if (meta.total === 0) {
    return (
      <p className="text-sm text-muted-foreground">{listRangeLabel(meta)}</p>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>{listRangeLabel(meta)}</span>
        <label className="flex items-center gap-2" htmlFor={pageSizeFieldId}>
          <span className="sr-only">Rows per page</span>
          <span aria-hidden>Rows</span>
          <Select
            autoComplete="off"
            className="h-8 w-auto min-w-[4.5rem] py-1"
            disabled={isLoading}
            id={pageSizeFieldId}
            name={pageSizeFieldId}
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {ADMIN_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              disabled={isLoading || page <= 1}
              onClick={() => onPageChange(page - 1)}
            />
          </PaginationItem>
          {items.map((item, index) =>
            item === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink
                  disabled={isLoading}
                  isActive={item === page}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              disabled={isLoading || page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
