import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AdminFkCell } from "@/components/admin-fk/admin-fk-cell";
import { AdminListPagination } from "@/components/admin-list-pagination";
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
import { useAdminListPagination } from "@/hooks/use-admin-list-pagination";
import { useForeignKey } from "@/hooks/use-foreign-key";
import { isUuid } from "@/lib/uuid";

export function OrdersPage() {
  const { page, pageSize, setPage, setPageSize } = useAdminListPagination();
  const { data, isLoading } = useQuery(
    adminApi.orders.list({ page, pageSize }),
  );
  const fk = useForeignKey({
    rows: data?.items ?? [],
    load: ["event", "person"],
  });
  const refundMutation = useMutation(adminApi.order.refund());

  const handleRefund = (orderId: string) => {
    refundMutation.mutate(orderId, {
      onSuccess: () => toast.success("Refund initiated"),
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Orders</h2>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <AdminFkCell
                      fk={fk}
                      foreignDisplayField="title"
                      foreignId={order.eventId}
                      foreignService="event"
                    />
                  </TableCell>
                  <TableCell>
                    <AdminFkCell
                      fk={fk}
                      foreignDisplayField={["givenName", "familyName"]}
                      foreignId={order.personId}
                      foreignService="person"
                    />
                  </TableCell>
                  <TableCell>
                    CHF {(order.amountCents / 100).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge>{order.status}</Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    {isUuid(order.id) && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/orders/${order.id}`}>View</Link>
                      </Button>
                    )}
                    {order.status === "paid" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm("Refund this order?")) {
                            handleRefund(order.id);
                          }
                        }}
                      >
                        Refund
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <AdminListPagination
            isLoading={isLoading}
            meta={data.meta}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
    </div>
  );
}
