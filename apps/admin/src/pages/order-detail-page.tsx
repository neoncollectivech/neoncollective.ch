import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "@/hooks/use-admin-api";
import { useUuidRouteParam } from "@/hooks/use-uuid-route-param";
import { isUuid } from "@/lib/uuid";

const DELETABLE_STATUSES = new Set(["pending", "failed"]);

export function OrderDetailPage() {
  const navigate = useNavigate();
  const { id: orderId, isValid } = useUuidRouteParam();
  const orderQuery = useQuery(adminApi.order.detail(orderId));
  const order = orderQuery.data;

  const personQuery = useQuery(adminApi.order.person(order?.personId));
  const eventQuery = useQuery(adminApi.order.event(order?.eventId));
  const orderTiersQuery = useQuery({
    ...adminApi.order.tiers(orderId),
    enabled: Boolean(orderId) && Boolean(order),
  });
  const eventTierIds = useMemo(
    () => orderTiersQuery.data?.items.map((line) => line.eventTierId) ?? [],
    [orderTiersQuery.data?.items],
  );
  const eventTiersQuery = useQuery(
    adminApi.order.eventTiersForOrder(eventTierIds),
  );
  const admissionQuery = useQuery({
    ...adminApi.order.admission(orderId),
    enabled: Boolean(orderId) && Boolean(order),
  });
  const inviteRedemptionQuery = useQuery({
    ...adminApi.order.inviteRedemption(orderId),
    enabled: Boolean(orderId) && Boolean(order),
  });

  const tierLines = useMemo(() => {
    const tierById = new Map(
      (eventTiersQuery.data?.items ?? []).map((tier) => [tier.id, tier]),
    );

    return (orderTiersQuery.data?.items ?? [])
      .map((line) => {
        const tier = tierById.get(line.eventTierId);

        if (!tier) {
          return null;
        }

        return {
          id: tier.id,
          name: tier.name,
          selectionMode: tier.selectionMode,
          unitPriceCents: line.unitPriceCents,
        };
      })
      .filter((line) => line != null);
  }, [eventTiersQuery.data?.items, orderTiersQuery.data?.items]);

  const refundMutation = useMutation(adminApi.order.refund(orderId));
  const deleteMutation = useMutation(adminApi.order.delete(orderId));
  const canDelete = order && DELETABLE_STATUSES.has(order.status);

  const isLoading =
    orderQuery.isLoading ||
    personQuery.isLoading ||
    eventQuery.isLoading ||
    orderTiersQuery.isLoading;

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
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Summary</CardTitle>
              <div className="flex gap-2">
                {canDelete && (
                  <Button
                    disabled={deleteMutation.isPending}
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (
                        confirm(
                          "Delete this order? This cannot be undone. Tier quota will be released.",
                        )
                      ) {
                        deleteMutation.mutate(orderId, {
                          onSuccess: () => {
                            toast.success("Order deleted");
                            navigate("/orders");
                          },
                        });
                      }
                    }}
                  >
                    Delete
                  </Button>
                )}
                {order.status === "paid" && (
                  <Button
                    disabled={refundMutation.isPending}
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Refund this order?")) {
                        refundMutation.mutate(orderId, {
                          onSuccess: () => toast.success("Refund initiated"),
                        });
                      }
                    }}
                  >
                    Refund
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Amount:</span> CHF{" "}
                {(order.amountCents / 100).toFixed(2)}
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
              {personQuery.data ? (
                <>
                  <p>
                    {personQuery.data.givenName} {personQuery.data.familyName}
                  </p>
                  <p className="text-muted-foreground">
                    {personQuery.data.email ?? "—"}
                  </p>
                  {isUuid(personQuery.data.id) && (
                    <Button
                      asChild
                      className="px-0 h-auto"
                      size="sm"
                      variant="ghost"
                    >
                      <Link to={`/people/${personQuery.data.id}`}>
                        View person
                      </Link>
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event & tiers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {eventQuery.data && isUuid(eventQuery.data.id) ? (
                <p>
                  <Link
                    className="text-primary hover:underline"
                    to={`/events/${eventQuery.data.id}`}
                  >
                    {eventQuery.data.title}
                  </Link>
                </p>
              ) : (
                <p className="text-muted-foreground">—</p>
              )}
              {tierLines.length === 0 ? (
                <p className="text-muted-foreground">No tiers recorded.</p>
              ) : (
                <ul className="space-y-1">
                  {tierLines.map((tier) => (
                    <li key={tier.id}>
                      <span className="text-muted-foreground">
                        {tier.selectionMode === "addon" ? "Add-on" : "Tier"}:
                      </span>{" "}
                      {tier.name} (CHF {(tier.unitPriceCents / 100).toFixed(2)})
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {admissionQuery.data && (
            <Card>
              <CardHeader>
                <CardTitle>Admission</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p>
                  Checked in:{" "}
                  {admissionQuery.data.checkedInAt
                    ? new Date(admissionQuery.data.checkedInAt).toLocaleString()
                    : "No"}
                </p>
              </CardContent>
            </Card>
          )}

          {inviteRedemptionQuery.data && (
            <Card>
              <CardHeader>
                <CardTitle>Invite redemption</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p>
                  Redeemed:{" "}
                  {new Date(
                    inviteRedemptionQuery.data.createdAt,
                  ).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
