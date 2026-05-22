import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { AdminListPagination } from "@/components/admin-list-pagination";
import { AdminSortableTableHead } from "@/components/admin-sortable-table-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi } from "@/hooks/use-admin-api";
import { useAdminListState } from "@/hooks/use-admin-list-state";
import { isUuid } from "@/lib/uuid";

export function EventsPage() {
  const list = useAdminListState({ defaultSortField: "title" });
  const { data, isLoading, error } = useQuery(
    adminApi.events.list({
      page: list.page,
      pageSize: list.pageSize,
      sort: list.sort,
    }),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Events</h2>
        <Button asChild>
          <Link to="/events/new">New event</Link>
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-red-400">Failed to load events.</p>}

      {data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <AdminSortableTableHead
                  field="title"
                  label="Title"
                  sortDirection={list.sortDirection}
                  sortField={list.sortField}
                  onSort={list.toggleSort}
                />
                <AdminSortableTableHead
                  field="slug"
                  label="Slug"
                  sortDirection={list.sortDirection}
                  sortField={list.sortField}
                  onSort={list.toggleSort}
                />
                <AdminSortableTableHead
                  field="status"
                  label="Status"
                  sortDirection={list.sortDirection}
                  sortField={list.sortField}
                  onSort={list.toggleSort}
                />
                <AdminSortableTableHead
                  field="accessMode"
                  label="Access"
                  sortDirection={list.sortDirection}
                  sortField={list.sortField}
                  onSort={list.toggleSort}
                />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((event) => (
                <TableRow key={event.id ?? event.slug}>
                  <TableCell className="font-medium">{event.title}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {event.slug}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        event.status === "published" ? "default" : "secondary"
                      }
                    >
                      {event.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{event.accessMode}</TableCell>
                  <TableCell>
                    {isUuid(event.id) ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/events/${event.id}`}>Open</Link>
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <AdminListPagination
            isLoading={isLoading}
            meta={data.meta}
            page={list.page}
            pageSize={list.pageSize}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
          />
        </>
      )}
    </div>
  );
}
