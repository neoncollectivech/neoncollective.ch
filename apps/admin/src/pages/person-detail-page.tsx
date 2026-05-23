import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";

import {
  PersonInviteesTable,
  PersonOrdersTable,
} from "@/components/person-detail-related-tables";
import { PersonEditFormFields } from "@/components/person-edit-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "@/hooks/use-admin-api";
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

export function PersonDetailPage() {
  const { id: personId, isValid } = useUuidRouteParam();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PersonEditForm | null>(null);

  const personQuery = useQuery(adminApi.person.detail(personId));
  const ordersQuery = useQuery(adminApi.person.orders(personId));
  const inviteesQuery = useQuery(adminApi.person.invitees(personId));
  const person = personQuery.data;

  useEffect(() => {
    if (person && editing) {
      setForm(personToEditForm(person));
    }
  }, [person, editing]);

  const updateMutation = useMutation(adminApi.person.update(personId));
  const verifyMutation = useMutation(adminApi.people.verify());

  const isLoading =
    personQuery.isLoading || ordersQuery.isLoading || inviteesQuery.isLoading;

  if (!isValid) {
    return <Navigate replace to="/people" />;
  }

  const orders = ordersQuery.data?.items ?? [];
  const invitees = inviteesQuery.data?.items ?? [];

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
              <PersonOrdersTable orders={orders} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invitees</CardTitle>
            </CardHeader>
            <CardContent>
              <PersonInviteesTable invitees={invitees} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
