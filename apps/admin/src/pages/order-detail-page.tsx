import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type ItemResponse } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";
import type { OrderDetail } from "@/lib/admin-types";
import { adminKeys } from "@/lib/query-keys";
import { isUuid } from "@/lib/uuid";

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const orderId = isUuid(id) ? id : "";
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: adminKeys.orders.detail(orderId),
    queryFn: async () => {
      const res = await api.get<ItemResponse<OrderDetail>>(`/admin/orders/${orderId}`);
      return res.data.item;
    },
    enabled: Boolean(orderId),
  });

  const refundMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/admin/orders/${orderId}/refund`);
    },
    onSuccess: () => {
      toast.success("Order refunded");
      void qc.invalidateQueries({ queryKey: adminKeys.orders.detail(orderId) });
      void qc.invalidateQueries({ queryKey: adminKeys.orders.all });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Refund failed")),
  });

  if (!orderId) {
    return <Navigate to="/orders" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/orders">← Orders</Link>
        </Button>
        <h2 className="text-2xl font-semibold">Order</h2>
        {order && <Badge>{order.status}</Badge>}
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {order && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Summary</CardTitle>
              {order.status === "paid" && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={refundMutation.isPending}
                  onClick={() => {
                    if (confirm("Refund this order?")) {
                      refundMutation.mutate();
                    }
                  }}
                >
                  Refund
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Amount:</span> CHF{" "}
                {(order.amountCents / 100).toFixed(2)}
              </p>
              <p>
                <span className="text-muted-foreground">Unit price:</span> CHF{" "}
                {(order.unitPriceCents / 100).toFixed(2)}
              </p>
              <p>
                <span className="text-muted-foreground">Locale:</span> {order.locale}
              </p>
              <p>
                <span className="text-muted-foreground">Created:</span>{" "}
                {new Date(order.createdAt).toLocaleString()}
              </p>
              {order.stripePaymentIntentId && (
                <p>
                  <span className="text-muted-foreground">Stripe PI:</span>{" "}
                  <code className="text-xs">{order.stripePaymentIntentId}</code>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Person</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>
                {order.person.givenName} {order.person.familyName}
              </p>
              <p className="text-muted-foreground">{order.person.email ?? "—"}</p>
              {isUuid(order.person.id) && (
                <Button variant="ghost" size="sm" className="px-0 h-auto" asChild>
                  <Link to={`/people/${order.person.id}`}>View person</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event & tier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {isUuid(order.event.id) && (
                <p>
                  <Link className="text-primary hover:underline" to={`/events/${order.event.id}`}>
                    {order.event.title}
                  </Link>
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Tier:</span> {order.tier.name} (CHF{" "}
                {(order.tier.priceCents / 100).toFixed(2)})
              </p>
            </CardContent>
          </Card>

          {order.admission && (
            <Card>
              <CardHeader>
                <CardTitle>Admission</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p>
                  Checked in:{" "}
                  {order.admission.checkedInAt
                    ? new Date(order.admission.checkedInAt).toLocaleString()
                    : "No"}
                </p>
              </CardContent>
            </Card>
          )}

          {order.inviteRedemption && (
            <Card>
              <CardHeader>
                <CardTitle>Invite redemption</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p>
                  Redeemed: {new Date(order.inviteRedemption.createdAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
