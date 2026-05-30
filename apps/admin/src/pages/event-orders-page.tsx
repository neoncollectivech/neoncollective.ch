import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { AdminDataTable } from "@/components/admin-data-table";
import { orderColumns } from "@/components/admin-data-table/columns/orders-columns";
import { adminApi } from "@/hooks/use-admin-api";
import { useEventIdParam } from "@/hooks/use-event-id-param";
import { ordersListService } from "@/lib/admin-list-services";

export function EventOrdersPage() {
  const { eventId } = useEventIdParam();
  const refundMutation = useMutation(adminApi.order.refund());

  const columns = useMemo(
    () =>
      orderColumns({
        eventId,
        hideEventColumn: true,
        isRefunding: refundMutation.isPending,
        onRefund: (orderId) => {
          refundMutation.mutate(orderId, {
            onSuccess: () => toast.success("Refund initiated"),
          });
        },
      }),
    [eventId, refundMutation],
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Orders</h2>
      <AdminDataTable
        columns={columns}
        fkScope={{ eventId }}
        scope={{ eventId }}
        service={ordersListService}
      />
    </div>
  );
}
