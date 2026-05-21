import type { EventInviteeListRow } from "@/lib/admin-api";
import type { InviteeUpsertPayload } from "@/lib/parse-invitees-csv";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";

import { AdminListPagination } from "@/components/admin-list-pagination";
import { EventCapacityStats } from "@/components/event-capacity-stats";
import { EventForm } from "@/components/event-form";
import {
  AddInviteeDialog,
  EditInviteeDialog,
} from "@/components/invitee-dialogs";
import { InviteeBulkImport } from "@/components/invitee-bulk-import";
import { InviteeLinkActions } from "@/components/invitee-link-actions";
import { TierEditor } from "@/components/tier-editor";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  eventToFormValues,
  formValuesToUpdatePayload,
} from "@/lib/event-form-utils";
import { adminApi } from "@/hooks/use-admin-api";
import { useAdminListPagination } from "@/hooks/use-admin-list-pagination";
import { useUuidRouteParam } from "@/hooks/use-uuid-route-param";

export function EventDetailPage() {
  const { id: eventId, isValid } = useUuidRouteParam();
  const [editing, setEditing] = useState(false);
  const [addInviteeOpen, setAddInviteeOpen] = useState(false);
  const [editInvitee, setEditInvitee] = useState<EventInviteeListRow | null>(
    null,
  );
  const [bulkImportKey, setBulkImportKey] = useState(0);
  const {
    page: inviteePage,
    pageSize: inviteePageSize,
    setPage: setInviteePage,
    setPageSize: setInviteePageSize,
  } = useAdminListPagination();

  const eventQuery = useQuery(adminApi.event.detail(eventId));
  const inviteesQuery = useQuery(
    adminApi.event.invitees(eventId, {
      page: inviteePage,
      pageSize: inviteePageSize,
    }),
  );
  const updateMutation = useMutation(adminApi.event.update(eventId));
  const upsertMutation = useMutation(adminApi.event.upsertInvitees(eventId));
  const revokeMutation = useMutation(adminApi.event.revokeInvitee(eventId));

  const event = eventQuery.data;

  if (!isValid) {
    return <Navigate replace to="/events" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild size="sm" variant="ghost">
          <Link to="/events">← Events</Link>
        </Button>
        <h2 className="text-2xl font-semibold">{event?.title ?? "Event"}</h2>
        {event && (
          <Badge
            variant={event.status === "published" ? "default" : "secondary"}
          >
            {event.status}
          </Badge>
        )}
      </div>

      {eventQuery.isLoading && (
        <p className="text-muted-foreground">Loading…</p>
      )}

      {event && (
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="tiers">Tiers</TabsTrigger>
            {event.accessMode === "invite_only" ? (
              <TabsTrigger value="invitees">Invitees</TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="details">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Details</CardTitle>
                {!editing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {editing ? (
                  <EventForm
                    key={`${event.id}-${editing}`}
                    initialValues={eventToFormValues(event)}
                    isPending={updateMutation.isPending}
                    mode="update"
                    onCancel={() => setEditing(false)}
                    onSubmit={(values) =>
                      updateMutation.mutate(formValuesToUpdatePayload(values), {
                        onSuccess: () => {
                          toast.success("Event updated");
                          setEditing(false);
                        },
                      })
                    }
                  />
                ) : (
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Slug:</span>{" "}
                      {event.slug}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Access:</span>{" "}
                      {event.accessMode}
                    </p>
                    {event.accessMode === "public" ? (
                      <p className="text-muted-foreground">
                        Event invites are not used for public events.
                      </p>
                    ) : null}
                    {event.location && (
                      <p>
                        <span className="text-muted-foreground">Location:</span>{" "}
                        {event.location}
                      </p>
                    )}
                    {event.startsAt && (
                      <p>
                        <span className="text-muted-foreground">Starts:</span>{" "}
                        {new Date(event.startsAt).toLocaleString()}
                      </p>
                    )}
                    {event.summary && <p>{event.summary}</p>}
                    <EventCapacityStats
                      capacity={event.capacity}
                      eventQuota={event.eventQuota}
                      tiers={event.tiers ?? []}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tiers">
            <Card>
              <CardHeader>
                <CardTitle>Tiers</CardTitle>
              </CardHeader>
              <CardContent>
                <TierEditor eventId={eventId} tiers={event.tiers ?? []} />
              </CardContent>
            </Card>
          </TabsContent>

          {event.accessMode === "invite_only" ? (
            <TabsContent value="invitees">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Invitees</CardTitle>
                  <Button size="sm" onClick={() => setAddInviteeOpen(true)}>
                    Add invitee
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InviteeBulkImport
                    key={bulkImportKey}
                    isPending={upsertMutation.isPending}
                    onImport={(invitees: InviteeUpsertPayload[]) =>
                      upsertMutation.mutate(invitees, {
                        onSuccess: (meta) => {
                          const parts: string[] = [];

                          if (meta.created > 0)
                            parts.push(`${meta.created} added`);
                          if (meta.skipped > 0)
                            parts.push(`${meta.skipped} already invited`);
                          if (meta.invalid > 0)
                            parts.push(
                              `${meta.invalid} invalid (no email/phone)`,
                            );
                          toast.success(
                            parts.length > 0 ? parts.join(", ") : "No changes",
                          );
                          setBulkImportKey((k) => k + 1);
                        },
                      })
                    }
                  />

                  {inviteesQuery.isLoading && (
                    <p className="text-muted-foreground text-sm">
                      Loading invitees…
                    </p>
                  )}
                  {inviteesQuery.data && (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Person</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Invite link</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inviteesQuery.data.items.map((inv) => (
                            <TableRow key={inv.id}>
                              <TableCell>{inv.email ?? "—"}</TableCell>
                              <TableCell>
                                {inv.phone ? `+${inv.phone}` : "—"}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {inv.personId ?? "—"}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {inv.notes ?? "—"}
                              </TableCell>
                              <TableCell>
                                {inv.revokedAt
                                  ? "Revoked"
                                  : !inv.personId
                                    ? "Profile pending"
                                    : "Active"}
                              </TableCell>
                              <TableCell className="min-w-[200px]">
                                <InviteeLinkActions
                                  defaultMaxRedemptions={
                                    event.defaultInviteLinkMaxRedemptions
                                  }
                                  eventId={eventId}
                                  eventSlug={event.slug}
                                  inviteeId={inv.id}
                                  personId={inv.personId}
                                  revoked={Boolean(inv.revokedAt)}
                                />
                              </TableCell>
                              <TableCell className="space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditInvitee(inv)}
                                >
                                  Edit
                                </Button>
                                {!inv.revokedAt && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      revokeMutation.mutate(inv.id, {
                                        onSuccess: () =>
                                          toast.success("Invitee revoked"),
                                      })
                                    }
                                  >
                                    Revoke
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <AdminListPagination
                        isLoading={inviteesQuery.isLoading}
                        meta={inviteesQuery.data.meta}
                        page={inviteePage}
                        pageSize={inviteePageSize}
                        onPageChange={setInviteePage}
                        onPageSizeChange={setInviteePageSize}
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ) : null}
        </Tabs>
      )}

      <AddInviteeDialog
        eventId={eventId}
        open={addInviteeOpen}
        onOpenChange={setAddInviteeOpen}
      />
      <EditInviteeDialog
        eventId={eventId}
        invitee={editInvitee}
        open={editInvitee != null}
        onOpenChange={(open) => {
          if (!open) setEditInvitee(null);
        }}
      />
    </div>
  );
}
