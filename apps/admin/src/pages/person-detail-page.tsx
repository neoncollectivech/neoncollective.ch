import type { PersonLinkCounts } from "@/lib/admin-api";
import type { ReactNode } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  PersonAdmissionsTable,
  PersonHostedInviteesTable,
  PersonInviteLinksTable,
  PersonInviteRedemptionsTable,
  PersonInviteesTable,
  PersonOrdersTable,
  PersonRegistrationsTable,
} from "@/components/person-detail-related-tables";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { PersonEditFormFields } from "@/components/person-edit-form";
import { PersonOverviewSummary } from "@/components/person-overview-summary";
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
import { personNeedsVerification } from "@/lib/person-verification";

function personDeletionBlockers(links: PersonLinkCounts): string | null {
  const parts: string[] = [];

  if (links.orders > 0) {
    parts.push(`${links.orders} order(s)`);
  }
  if (links.inviteesAsGuest > 0) {
    parts.push(`${links.inviteesAsGuest} event invite(s)`);
  }
  if (links.inviteesAsHost > 0) {
    parts.push(`${links.inviteesAsHost} host invitee record(s)`);
  }
  if (links.inviteLinksAsHost > 0) {
    parts.push(`${links.inviteLinksAsHost} guest invite link(s)`);
  }
  if (parts.length === 0) {
    return null;
  }

  return `Cannot delete: linked ${parts.join(", ")}.`;
}

type PersonSectionProps = {
  id: string;
  title: string;
  children: ReactNode;
};

function PersonSection({ id, title, children }: PersonSectionProps) {
  return (
    <Card id={`person-${id}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function PersonDetailPage() {
  const navigate = useNavigate();
  const { id: personId, isValid } = useUuidRouteParam();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PersonEditForm | null>(null);

  const personQuery = useQuery(adminApi.person.detail(personId));
  const ordersQuery = useQuery(adminApi.person.orders(personId));
  const registrationsQuery = useQuery(adminApi.person.registrations(personId));
  const admissionsQuery = useQuery(adminApi.person.admissions(personId));
  const inviteesQuery = useQuery(adminApi.person.invitees(personId));
  const hostedInviteesQuery = useQuery(
    adminApi.person.hostedInvitees(personId),
  );
  const inviteLinksQuery = useQuery(adminApi.person.inviteLinks(personId));
  const deletionEligibilityQuery = useQuery(
    adminApi.person.deletionEligibility(personId),
  );

  const orders = ordersQuery.data?.items ?? [];
  const orderIds = useMemo(() => orders.map((order) => order.id), [orders]);
  const orderEventById = useMemo(
    () => new Map(orders.map((order) => [order.id, order.eventId])),
    [orders],
  );

  const redemptionsQuery = useQuery(
    adminApi.person.inviteRedemptionsForOrders(orderIds),
  );

  const person = personQuery.data;

  useEffect(() => {
    if (!editing) {
      setForm(null);

      return;
    }
    if (person) {
      setForm((prev) => prev ?? personToEditForm(person));
    }
  }, [person, editing]);

  const updateMutation = useMutation(adminApi.person.update(personId));
  const verifyMutation = useMutation(adminApi.people.verify());
  const deleteMutation = useMutation(adminApi.person.delete(personId));

  const isLoading =
    personQuery.isLoading ||
    ordersQuery.isLoading ||
    registrationsQuery.isLoading ||
    admissionsQuery.isLoading ||
    inviteesQuery.isLoading ||
    hostedInviteesQuery.isLoading ||
    inviteLinksQuery.isLoading ||
    redemptionsQuery.isLoading ||
    deletionEligibilityQuery.isLoading;

  const deletable = deletionEligibilityQuery.data?.deletable === true;
  const deletionBlockers = deletionEligibilityQuery.data?.links
    ? personDeletionBlockers(deletionEligibilityQuery.data.links)
    : null;

  if (!isValid) {
    return <Navigate replace to="/people" />;
  }

  const admissions = admissionsQuery.data?.items ?? [];
  const registrations = registrationsQuery.data?.items ?? [];
  const invitees = inviteesQuery.data?.items ?? [];
  const hostedInvitees = hostedInviteesQuery.data?.items ?? [];
  const inviteLinks = inviteLinksQuery.data?.items ?? [];
  const inviteRedemptions = (redemptionsQuery.data?.items ?? [])
    .map((redemption) => {
      const eventId = orderEventById.get(redemption.orderId);

      if (!eventId) {
        return null;
      }

      return { ...redemption, eventId };
    })
    .filter((row) => row != null);

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

      {isLoading && !person ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : null}

      {person ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <PersonOverviewSummary
                admissions={admissions.length}
                inviteRedemptions={inviteRedemptions.length}
                isLoading={isLoading}
                links={deletionEligibilityQuery.data?.links}
              />
            </CardContent>
          </Card>

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
                {!editing && deletable ? (
                  <Button
                    disabled={deleteMutation.isPending}
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      confirm({
                        title: "Delete this person?",
                        description: "This cannot be undone.",
                        confirmLabel: "Delete",
                        variant: "destructive",
                        onConfirm: () =>
                          deleteMutation.mutate(undefined, {
                            onSuccess: () => {
                              toast.success("Person deleted");
                              navigate("/people");
                            },
                          }),
                      })
                    }
                  >
                    Delete
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
                  <p>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    {new Date(person.createdAt).toLocaleString()}
                  </p>
                  {!editing && deletionBlockers ? (
                    <p className="text-muted-foreground">{deletionBlockers}</p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <PersonSection id="orders" title="Orders">
            <PersonOrdersTable orders={orders} />
          </PersonSection>

          <PersonSection id="registrations" title="Registrations">
            <PersonRegistrationsTable registrations={registrations} />
          </PersonSection>

          <PersonSection id="admissions" title="Admissions">
            <PersonAdmissionsTable admissions={admissions} />
          </PersonSection>

          <PersonSection id="event-invites" title="Event invites">
            <PersonInviteesTable invitees={invitees} />
          </PersonSection>

          <PersonSection id="guest-invite-links" title="Guest invite links">
            <PersonInviteLinksTable links={inviteLinks} />
          </PersonSection>

          <PersonSection id="guests-invited" title="Guests invited">
            <PersonHostedInviteesTable invitees={hostedInvitees} />
          </PersonSection>

          <PersonSection id="invite-redemptions" title="Invite redemptions">
            <PersonInviteRedemptionsTable redemptions={inviteRedemptions} />
          </PersonSection>
        </>
      ) : null}
      <ConfirmDialog />
    </div>
  );
}
