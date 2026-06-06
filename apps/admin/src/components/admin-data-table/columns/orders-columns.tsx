import type { AdminColumnDef } from "@/components/admin-data-table/types";
import type { OrderRow } from "@/lib/admin-api";

import {
  adminActionsColumn,
  adminBadgeColumn,
  adminDateColumn,
  adminFkColumn,
  adminMoneyColumn,
} from "@/components/admin-data-table/column-helpers";
import { useConfirmDialog } from "@/components/confirm-dialog";
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

function OrderRefundButton({
  orderId,
  disabled,
  onRefund,
}: {
  orderId: string;
  disabled?: boolean;
  onRefund: (orderId: string) => void;
}) {
  const { confirm, ConfirmDialog } = useConfirmDialog();

  return (
    <>
      <Button
        disabled={disabled}
        size="sm"
        variant="destructive"
        onClick={() =>
          confirm({
            title: "Refund this order?",
            confirmLabel: "Refund",
            variant: "destructive",
            onConfirm: () => onRefund(orderId),
          })
        }
      >
        Refund
      </Button>
      <ConfirmDialog />
    </>
  );
}

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
          <OrderRefundButton
            disabled={opts.isRefunding}
            orderId={order.id}
            onRefund={opts.onRefund}
          />
        );
      },
    }),
  );

  return cols;
}
