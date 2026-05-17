import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "@/hooks/use-admin-api";
import { useUuidRouteParam } from "@/hooks/use-uuid-route-param";
import { isUuid } from "@/lib/uuid";

export function OrderDetailPage() {
  const { id: orderId, isValid } = useUuidRouteParam();
  const { data: order, isLoading } = useQuery(adminApi.order.detail(orderId));
  const refundMutation = useMutation(adminApi.order.refund(orderId));

  if (!isValid) {
    return <Navigate replace to="/orders" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild size="sm" variant="ghost">
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
                  disabled={refundMutation.isPending}
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Refund this order?")) {
                      refundMutation.mutate(orderId, {
                        onSuccess: () => toast.success("Order refunded"),
                      });
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
                <span className="text-muted-foreground">Locale:</span>{" "}
                {order.locale}
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
              <p className="text-muted-foreground">
                {order.person.email ?? "—"}
              </p>
              {isUuid(order.person.id) && (
                <Button
                  asChild
                  className="px-0 h-auto"
                  size="sm"
                  variant="ghost"
                >
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
                  <Link
                    className="text-primary hover:underline"
                    to={`/events/${order.event.id}`}
                  >
                    {order.event.title}
                  </Link>
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Tier:</span>{" "}
                {order.tier.name} (CHF{" "}
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
                  Redeemed:{" "}
                  {new Date(order.inviteRedemption.createdAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
