import type { AdminColumnDef } from "@/components/admin-data-table/types";
import type { OrderRow } from "@/lib/admin-api";

import { Link } from "react-router-dom";

import {
  adminActionsColumn,
  adminBadgeColumn,
  adminDateColumn,
  adminFkColumn,
  adminMoneyColumn,
} from "@/components/admin-data-table/column-helpers";
import { Button } from "@/components/ui/button";
import { eventFkService, personFkService } from "@/lib/admin-fk-services";
import { isUuid } from "@/lib/uuid";

type OrderColumnsOptions = {
  onRefund: (orderId: string) => void;
  isRefunding?: boolean;
};

export function orderColumns(
  opts: OrderColumnsOptions,
): AdminColumnDef<OrderRow>[] {
  return [
    adminDateColumn("createdAt", { header: "Date & time", sortable: true }),
    adminFkColumn("eventId", {
      header: "Event",
      fk: eventFkService,
      display: "title",
    }),
    adminFkColumn("personId", {
      header: "Person",
      fk: personFkService,
      display: ["givenName", "familyName"],
    }),
    adminMoneyColumn("amountCents", { header: "Amount", sortable: true }),
    adminBadgeColumn("status", { header: "Status", sortable: true }),
    adminActionsColumn({
      cell: ({ row }) => {
        const order = row.original;

        return (
          <div className="space-x-2">
            {isUuid(order.id) ? (
              <Button asChild size="sm" variant="ghost">
                <Link to={`/orders/${order.id}`}>View</Link>
              </Button>
            ) : null}
            {order.status === "paid" ? (
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
            ) : null}
          </div>
        );
      },
    }),
  ];
}
