import type { AdminColumnDef } from "@/components/admin-data-table/types";
import type { EventRow } from "@/lib/admin-api";

import { Link } from "react-router-dom";

import {
  adminActionsColumn,
  adminBadgeColumn,
  adminTextColumn,
} from "@/components/admin-data-table/column-helpers";
import { Button } from "@/components/ui/button";
import { isUuid } from "@/lib/uuid";

export function eventsColumns(): AdminColumnDef<EventRow>[] {
  return [
    adminTextColumn("title", {
      header: "Title",
      sortable: true,
      className: "font-medium",
    }),
    adminTextColumn("slug", {
      header: "Slug",
      sortable: true,
      className: "text-muted-foreground",
    }),
    adminBadgeColumn("status", {
      header: "Status",
      sortable: true,
      variant: (value) => (value === "published" ? "default" : "secondary"),
    }),
    adminTextColumn("accessMode", { header: "Access", sortable: true }),
    adminActionsColumn({
      cell: ({ row }) => {
        const event = row.original;

        return isUuid(event.id) ? (
          <Button asChild size="sm" variant="ghost">
            <Link to={`/events/${event.id}`}>Open</Link>
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        );
      },
    }),
  ];
}
