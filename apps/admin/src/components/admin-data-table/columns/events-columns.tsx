import type { AdminColumnDef } from "@/components/admin-data-table/types";
import type { EventRow } from "@/lib/admin-api";

import {
  adminBadgeColumn,
  adminLinkColumn,
  adminTextColumn,
} from "@/components/admin-data-table/column-helpers";
import { eventOverviewPath } from "@/lib/event-workspace-paths";
import { isUuid } from "@/lib/uuid";

export function eventsColumns(): AdminColumnDef<EventRow>[] {
  return [
    adminLinkColumn({
      id: "title",
      accessorKey: "title",
      header: "Title",
      sortable: true,
      className: "font-medium",
      getLabel: (event) => event.title,
      getHref: (event) =>
        isUuid(event.id) ? eventOverviewPath(event.id) : undefined,
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
  ];
}
