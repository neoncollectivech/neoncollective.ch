import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";

import { AdminSortableTableHead } from "@/components/admin-sortable-table-head";
import { PersonEditFormFields } from "@/components/person-edit-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi } from "@/hooks/use-admin-api";
import { useClientTableSort } from "@/hooks/use-client-table-sort";
import { useUuidRouteParam } from "@/hooks/use-uuid-route-param";
import {
  personEditFormToPayload,
  personToEditForm,
  type PersonEditForm,
} from "@/lib/person-form-utils";
import {
  personNeedsVerification,
  personVerificationSummary,
} from "@/lib/person-verification";
import { isUuid } from "@/lib/uuid";

export function PersonDetailPage() {
  const { id: personId, isValid } = useUuidRouteParam();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PersonEditForm | null>(null);

  const personQuery = useQuery(adminApi.person.detail(personId));
  const ordersQuery = useQuery(adminApi.person.orders(personId));
  const inviteesQuery = useQuery(adminApi.person.invitees(personId));
  const person = personQuery.data;

  const eventIds = useMemo(() => {
    const ids = new Set<string>();

    for (const order of ordersQuery.data?.items ?? []) {
      ids.add(order.eventId);
    }
    for (const invitee of inviteesQuery.data?.items ?? []) {
      ids.add(invitee.eventId);
    }

    return [...ids];
  }, [inviteesQuery.data?.items, ordersQuery.data?.items]);

  const eventsQuery = useQuery(adminApi.person.eventsByIds(eventIds));

  const orders = useMemo(
    () =>
      (ordersQuery.data?.items ?? []).map((order) => ({
        ...order,
        eventTitle:
          eventsQuery.data?.get(order.eventId)?.title ?? order.eventId,
      })),
    [eventsQuery.data, ordersQuery.data?.items],
  );

  const invitees = useMemo(
    () =>
      (inviteesQuery.data?.items ?? []).map((invitee) => ({
        id: invitee.id,
        eventId: invitee.eventId,
        revokedAt: invitee.revokedAt,
        eventTitle:
          eventsQuery.data?.get(invitee.eventId)?.title ?? invitee.eventId,
      })),
    [eventsQuery.data, inviteesQuery.data?.items],
  );

  useEffect(() => {
    if (person && editing) {
      setForm(personToEditForm(person));
    }
  }, [person, editing]);

  const updateMutation = useMutation(adminApi.person.update(personId));
  const verifyMutation = useMutation(adminApi.people.verify());

  const ordersSort = useClientTableSort(orders, {
    defaultField: "eventTitle",
  });
  const inviteesSort = useClientTableSort(invitees, {
    defaultField: "eventTitle",
    getValue: (row, field) => {
      if (field === "status") {
        return row.revokedAt ? "revoked" : "active";
      }

      return (row as Record<string, unknown>)[field] as
        | string
        | null
        | undefined;
    },
  });

  const isLoading =
    personQuery.isLoading ||
    ordersQuery.isLoading ||
    inviteesQuery.isLoading ||
    (eventIds.length > 0 && eventsQuery.isLoading);

  if (!isValid) {
    return <Navigate replace to="/people" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild size="sm" variant="ghost">
          <Link to="/people">← People</Link>
        </Button>
        <h2 className="text-2xl font-semibold">
          {person ? `${person.givenName} ${person.familyName}` : "Person"}
        </h2>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {person && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Contact</CardTitle>
              <div className="flex flex-wrap gap-2">
                {!editing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </Button>
                )}
                {!editing && personNeedsVerification(person) ? (
                  <Button
                    disabled={verifyMutation.isPending}
                    size="sm"
                    onClick={() =>
                      verifyMutation.mutate([personId], {
                        onSuccess: () => toast.success("Contact verified"),
                      })
                    }
                  >
                    {verifyMutation.isPending ? "Verifying…" : "Verify contact"}
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {editing && form ? (
                <PersonEditFormFields
                  form={form}
                  isPending={updateMutation.isPending}
                  onCancel={() => setEditing(false)}
                  onChange={setForm}
                  onSubmit={() =>
                    updateMutation.mutate(personEditFormToPayload(form), {
                      onSuccess: () => {
                        toast.success("Person updated");
                        setEditing(false);
                      },
                    })
                  }
                />
              ) : (
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    {person.email ?? "—"}
                    {person.email ? (
                      <Badge
                        className="ml-2"
                        variant={
                          person.emailVerifiedAt ? "default" : "secondary"
                        }
                      >
                        {person.emailVerifiedAt ? "Verified" : "Pending"}
                      </Badge>
                    ) : null}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    {person.phone ? `+${person.phone}` : "—"}
                    {person.phone ? (
                      <Badge
                        className="ml-2"
                        variant={
                          person.phoneVerifiedAt ? "default" : "secondary"
                        }
                      >
                        {person.phoneVerifiedAt ? "Verified" : "Pending"}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground">
                    {personVerificationSummary(person)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    {new Date(person.createdAt).toLocaleString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <AdminSortableTableHead
                        field="eventTitle"
                        label="Event"
                        sortDirection={ordersSort.sortDirection}
                        sortField={ordersSort.sortField}
                        onSort={ordersSort.toggleSort}
                      />
                      <AdminSortableTableHead
                        field="amountCents"
                        label="Amount"
                        sortDirection={ordersSort.sortDirection}
                        sortField={ordersSort.sortField}
                        onSort={ordersSort.toggleSort}
                      />
                      <AdminSortableTableHead
                        field="status"
                        label="Status"
                        sortDirection={ordersSort.sortDirection}
                        sortField={ordersSort.sortField}
                        onSort={ordersSort.toggleSort}
                      />
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersSort.rows.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Link
                            className="text-primary hover:underline"
                            to={`/events/${order.eventId}`}
                          >
                            {order.eventTitle}
                          </Link>
                        </TableCell>
                        <TableCell>
                          CHF {(order.amountCents / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge>{order.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {isUuid(order.id) && (
                            <Button asChild size="sm" variant="ghost">
                              <Link to={`/orders/${order.id}`}>View</Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invitees</CardTitle>
            </CardHeader>
            <CardContent>
              {invitees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invitees.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <AdminSortableTableHead
                        field="eventTitle"
                        label="Event"
                        sortDirection={inviteesSort.sortDirection}
                        sortField={inviteesSort.sortField}
                        onSort={inviteesSort.toggleSort}
                      />
                      <AdminSortableTableHead
                        field="status"
                        label="Status"
                        sortDirection={inviteesSort.sortDirection}
                        sortField={inviteesSort.sortField}
                        onSort={inviteesSort.toggleSort}
                      />
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inviteesSort.rows.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <Link
                            className="text-primary hover:underline"
                            to={`/events/${inv.eventId}`}
                          >
                            {inv.eventTitle}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {inv.revokedAt ? (
                            <Badge variant="secondary">Revoked</Badge>
                          ) : (
                            <Badge>Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isUuid(inv.eventId) && (
                            <Button asChild size="sm" variant="ghost">
                              <Link to={`/events/${inv.eventId}`}>Event</Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
