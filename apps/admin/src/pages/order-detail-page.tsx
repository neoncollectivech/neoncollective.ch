import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "@/hooks/use-admin-api";
import { useEventIdParam, useOrderIdParam } from "@/hooks/use-event-id-param";
import {
  eventOrdersPath,
  eventOrderPath,
  eventOverviewPath,
} from "@/lib/event-workspace-paths";
import { isUuid } from "@/lib/uuid";

function isAdminDeletableOrder(order: {
  status: string;
  amountCents: number;
  stripePaymentIntentId: string | null;
}): boolean {
  if (order.status === "pending") {
    return true;
  }
  return (
    order.status === "paid" &&
    order.amountCents === 0 &&
    order.stripePaymentIntentId == null
  );
}

export function OrderDetailPage() {
  const navigate = useNavigate();
  const { eventId: routeEventId, isValid: eventIdValid } = useEventIdParam();
  const { orderId, isValid: orderIdValid } = useOrderIdParam();
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
    adminApi.order.eventTiersForOrder(eventTierIds, order?.eventId),
  );
  const admissionQuery = useQuery({
    ...adminApi.order.admission(orderId),
    enabled: Boolean(orderId) && Boolean(order),
  });
  const inviteRedemptionQuery = useQuery({
    ...adminApi.order.inviteRedemption(orderId),
    enabled: Boolean(orderId) && Boolean(order),
  });
  const promotionCodeQuery = useQuery(
    adminApi.order.promotionCode(order?.promotionCodeId),
  );

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
  const canDelete = order && isAdminDeletableOrder(order);

  const isLoading =
    orderQuery.isLoading ||
    personQuery.isLoading ||
    eventQuery.isLoading ||
    orderTiersQuery.isLoading;

  useEffect(() => {
    if (!order || !orderIdValid || !eventIdValid) {
      return;
    }

    if (order.eventId !== routeEventId) {
      navigate(eventOrderPath(order.eventId, order.id), { replace: true });
    }
  }, [order, routeEventId, orderIdValid, eventIdValid, navigate]);

  if (!eventIdValid || !orderIdValid) {
    return <Navigate replace to="/events" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild size="sm" variant="ghost">
          <Link to={eventOrdersPath(routeEventId)}>← Orders</Link>
        </Button>
        <h2 className="text-2xl font-semibold">Order</h2>
        {order && <Badge>{order.status}</Badge>}
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {order && order.eventId === routeEventId && (
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
                          order.status === "pending"
                            ? "Delete this pending order? This cannot be undone. Related tier lines and admissions will be removed."
                            : "Delete this free order? This cannot be undone. Related tier lines and admissions will be removed.",
                        )
                      ) {
                        deleteMutation.mutate(orderId, {
                          onSuccess: () => {
                            toast.success("Order deleted");
                            navigate(eventOrdersPath(routeEventId));
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
              {order.promotionCodeId && (
                <p>
                  <span className="text-muted-foreground">Promotion:</span>{" "}
                  {promotionCodeQuery.data?.code ?? order.promotionCodeId}
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
                    to={eventOverviewPath(eventQuery.data.id)}
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
