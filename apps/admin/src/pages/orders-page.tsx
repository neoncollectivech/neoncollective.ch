import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AdminListPagination } from "@/components/admin-list-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi, useAdminForeignKeys } from "@/hooks/use-admin-api";
import { useAdminListPagination } from "@/hooks/use-admin-list-pagination";
import { isUuid } from "@/lib/uuid";

export function OrdersPage() {
  const { page, pageSize, setPage, setPageSize } = useAdminListPagination();
  const { data, isLoading } = useQuery(
    adminApi.orders.list({ page, pageSize }),
  );
  const {
    eventById,
    personById,
    isPending: fkPending,
    isFetching: fkFetching,
  } = useAdminForeignKeys(data?.items ?? []);
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
                <TableHead>Event ID</TableHead>
                <TableHead>Person ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">
                    {fkPending ? (
                      <span className="mr-2 inline-flex align-middle">
                        <InlineSpinner />
                      </span>
                    ) : null}
                    {isUuid(order.eventId) ? (
                      <Link
                        className="text-primary hover:underline"
                        to={`/events/${order.eventId}`}
                      >
                        {eventById.get(order.eventId)?.title ??
                          `${order.eventId.slice(0, 8)}…`}
                      </Link>
                    ) : (
                      order.eventId
                    )}
                    {!fkPending && fkFetching ? (
                      <span className="ml-2 inline-flex align-middle">
                        <InlineSpinner />
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {fkPending ? (
                      <span className="mr-2 inline-flex align-middle">
                        <InlineSpinner />
                      </span>
                    ) : null}
                    {isUuid(order.personId) ? (
                      <Link
                        className="text-primary hover:underline"
                        to={`/people/${order.personId}`}
                      >
                        {(() => {
                          const person = personById.get(order.personId);

                          if (!person) {
                            return `${order.personId.slice(0, 8)}…`;
                          }

                          return `${person.givenName ?? ""} ${person.familyName ?? ""}`.trim();
                        })()}
                      </Link>
                    ) : (
                      order.personId
                    )}
                    {!fkPending && fkFetching ? (
                      <span className="ml-2 inline-flex align-middle">
                        <InlineSpinner />
                      </span>
                    ) : null}
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
