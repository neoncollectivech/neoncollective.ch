import type { AdminColumnDef } from "@/components/admin-data-table/types";
import type { OrderRow } from "@/lib/admin-api";

import {
  adminActionsColumn,
  adminBadgeColumn,
  adminDateColumn,
  adminFkColumn,
  adminMoneyColumn,
} from "@/components/admin-data-table/column-helpers";
import { Button } from "@/components/ui/button";
import { eventFkService, personFkService } from "@/lib/admin-fk-services";
import { eventOrderPath } from "@/lib/event-workspace-paths";
import { isUuid } from "@/lib/uuid";

type OrderColumnsOptions = {
  eventId: string;
  onRefund: (orderId: string) => void;
  isRefunding?: boolean;
  hideEventColumn?: boolean;
};

export function orderColumns(
  opts: OrderColumnsOptions,
): AdminColumnDef<OrderRow>[] {
  const cols: AdminColumnDef<OrderRow>[] = [
    adminFkColumn("personId", {
      header: "Guest",
      fk: personFkService,
      display: ["givenName", "familyName"],
      sortable: true,
      href: (order) =>
        isUuid(order.id) ? eventOrderPath(opts.eventId, order.id) : undefined,
    }),
    adminDateColumn("createdAt", { header: "Date & time", sortable: true }),
  ];

  if (!opts.hideEventColumn) {
    cols.push(
      adminFkColumn("eventId", {
        header: "Event",
        fk: eventFkService,
        display: "title",
      }),
    );
  }

  cols.push(
    adminMoneyColumn("amountCents", { header: "Amount", sortable: true }),
    adminBadgeColumn("orderKind", {
      header: "Kind",
      sortable: true,
      variant: (value) => (value === "upsell" ? "secondary" : "default"),
    }),
    adminBadgeColumn("status", { header: "Status", sortable: true }),
    adminActionsColumn({
      cell: ({ row }) => {
        const order = row.original;

        if (order.status !== "paid") {
          return "—";
        }

        return (
          <Button
            disabled={opts.isRefunding}
            size="sm"
            variant="destructive"
            onClick={() => {
              if (confirm("Refund this order?")) {
                opts.onRefund(order.id);
              }
            }}
          >
            Refund
          </Button>
        );
      },
    }),
  );

  return cols;
}
