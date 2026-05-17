import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";

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
import { api, type ListResponse } from "@/lib/api-client";
import { adminKeys } from "@/lib/query-keys";
import { isUuid } from "@/lib/uuid";

type OrderRow = {
  id: string;
  status: string;
  amountCents: number;
  person: { givenName: string; familyName: string; email: string | null };
  event: { id: string; title: string; slug: string };
};

export function OrdersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: adminKeys.orders.list(),
    queryFn: async () => {
      const res = await api.get<ListResponse<OrderRow>>("/admin/orders");
      return res.data;
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await api.post(`/admin/orders/${orderId}/refund`);
    },
    onSuccess: () => {
      toast.success("Order refunded");
      void qc.invalidateQueries({ queryKey: adminKeys.orders.all });
    },
    onError: () => toast.error("Refund failed"),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Orders</h2>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {data && (
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
                  <Link
                    className="text-primary hover:underline"
                    to={`/events/${order.event.id}`}
                  >
                    {order.event.title}
                  </Link>
                </TableCell>
                <TableCell>
                  {order.person.givenName} {order.person.familyName}
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {order.person.email}
                  </span>
                </TableCell>
                <TableCell>CHF {(order.amountCents / 100).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge>{order.status}</Badge>
                </TableCell>
                <TableCell className="space-x-2">
                  {isUuid(order.id) && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/orders/${order.id}`}>View</Link>
                    </Button>
                  )}
                  {order.status === "paid" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm("Refund this order?")) {
                          refundMutation.mutate(order.id);
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
      )}
    </div>
  );
}
