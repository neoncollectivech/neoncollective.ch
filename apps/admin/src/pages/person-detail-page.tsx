import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";

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
import { api, type ItemResponse } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";
import type { PersonDetail } from "@/lib/admin-types";
import {
  personEditFormToPayload,
  personToEditForm,
  type PersonEditForm,
} from "@/lib/person-form-utils";
import {
  personNeedsVerification,
  personVerificationSummary,
} from "@/lib/person-verification";
import { adminKeys } from "@/lib/query-keys";
import { isUuid } from "@/lib/uuid";

export function PersonDetailPage() {
  const { id = "" } = useParams();
  const personId = isUuid(id) ? id : "";
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PersonEditForm | null>(null);

  const { data: person, isLoading } = useQuery({
    queryKey: adminKeys.people.detail(personId),
    queryFn: async () => {
      const res = await api.get<ItemResponse<PersonDetail>>(`/admin/people/${personId}`);
      return res.data.item;
    },
    enabled: Boolean(personId),
  });

  useEffect(() => {
    if (person && editing) {
      setForm(personToEditForm(person));
    }
  }, [person, editing]);

  const updateMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof personEditFormToPayload>) => {
      const res = await api.patch<ItemResponse<PersonDetail>>(
        `/admin/people/${personId}`,
        payload,
      );
      return res.data.item;
    },
    onSuccess: () => {
      toast.success("Person updated");
      setEditing(false);
      void qc.invalidateQueries({ queryKey: adminKeys.people.detail(personId) });
      void qc.invalidateQueries({ queryKey: adminKeys.people.all });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update person")),
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      await api.post("/admin/people/verify", { personIds: [personId] });
    },
    onSuccess: () => {
      toast.success("Contact verified");
      void qc.invalidateQueries({ queryKey: adminKeys.people.detail(personId) });
      void qc.invalidateQueries({ queryKey: adminKeys.people.all });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Verification failed")),
  });

  if (!personId) {
    return <Navigate to="/people" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
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
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )}
                {!editing && personNeedsVerification(person) ? (
                  <Button
                    size="sm"
                    disabled={verifyMutation.isPending}
                    onClick={() => verifyMutation.mutate()}
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
                  onChange={setForm}
                  onCancel={() => setEditing(false)}
                  onSubmit={() => updateMutation.mutate(personEditFormToPayload(form))}
                />
              ) : (
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Email:</span> {person.email ?? "—"}
                    {person.email ? (
                      <Badge
                        className="ml-2"
                        variant={person.emailVerifiedAt ? "default" : "secondary"}
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
                        variant={person.phoneVerifiedAt ? "default" : "secondary"}
                      >
                        {person.phoneVerifiedAt ? "Verified" : "Pending"}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground">{personVerificationSummary(person)}</p>
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
              {person.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {person.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Link
                            className="text-primary hover:underline"
                            to={`/events/${order.eventId}`}
                          >
                            {order.eventTitle}
                          </Link>
                        </TableCell>
                        <TableCell>CHF {(order.amountCents / 100).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge>{order.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {isUuid(order.id) && (
                            <Button variant="ghost" size="sm" asChild>
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
              {person.invitees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invitees.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {person.invitees.map((inv) => (
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
                            <Button variant="ghost" size="sm" asChild>
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
