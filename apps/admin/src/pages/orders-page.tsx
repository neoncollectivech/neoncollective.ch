import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { AdminDataTable } from "@/components/admin-data-table";
import { orderColumns } from "@/components/admin-data-table/columns/orders-columns";
import { adminApi } from "@/hooks/use-admin-api";
import { ordersListService } from "@/lib/admin-list-services";

export function OrdersPage() {
  const refundMutation = useMutation(adminApi.order.refund());

  const columns = useMemo(
    () =>
      orderColumns({
        isRefunding: refundMutation.isPending,
        onRefund: (orderId) => {
          refundMutation.mutate(orderId, {
            onSuccess: () => toast.success("Refund initiated"),
          });
        },
      }),
    [refundMutation],
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Orders</h2>
      <AdminDataTable columns={columns} service={ordersListService} />
    </div>
  );
}
