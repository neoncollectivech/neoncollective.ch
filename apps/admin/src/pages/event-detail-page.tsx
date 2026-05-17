import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { EventForm } from "@/components/event-form";
import { AddInviteeDialog, EditInviteeDialog } from "@/components/invitee-dialogs";
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
import { api, type ItemResponse, type ListResponse } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";
import type { EventDetail, InviteeRow } from "@/lib/admin-types";
import { eventToFormValues, formValuesToUpdatePayload } from "@/lib/event-form-utils";
import type { InviteeUpsertPayload } from "@/lib/parse-invitees-csv";
import { adminKeys } from "@/lib/query-keys";
import { isUuid } from "@/lib/uuid";

export function EventDetailPage() {
  const { id = "" } = useParams();
  const eventId = isUuid(id) ? id : "";
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [addInviteeOpen, setAddInviteeOpen] = useState(false);
  const [editInvitee, setEditInvitee] = useState<InviteeRow | null>(null);
  const [bulkImportKey, setBulkImportKey] = useState(0);

  const eventQuery = useQuery({
    queryKey: adminKeys.events.detail(eventId),
    queryFn: async () => {
      const res = await api.get<ItemResponse<EventDetail>>(`/admin/events/${eventId}`);
      return res.data.item;
    },
    enabled: Boolean(eventId),
  });

  const inviteesQuery = useQuery({
    queryKey: adminKeys.events.invitees(eventId),
    queryFn: async () => {
      const res = await api.get<ListResponse<InviteeRow>>(
        `/admin/events/${eventId}/invitees`,
      );
      return res.data.items;
    },
    enabled: Boolean(eventId),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof formValuesToUpdatePayload>) => {
      const res = await api.patch<ItemResponse<EventDetail>>(
        `/admin/events/${eventId}`,
        payload,
      );
      return res.data.item;
    },
    onSuccess: () => {
      toast.success("Event updated");
      setEditing(false);
      void qc.invalidateQueries({ queryKey: adminKeys.events.detail(eventId) });
      void qc.invalidateQueries({ queryKey: adminKeys.events.all });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update event")),
  });

  const upsertMutation = useMutation({
    mutationFn: async (invitees: InviteeUpsertPayload[]) => {
      const res = await api.post<{
        meta: { created: number; skipped: number; invalid: number };
      }>(`/admin/events/${eventId}/invitees`, { invitees });
      return res.data.meta;
    },
    onSuccess: (meta) => {
      const parts: string[] = [];
      if (meta.created > 0) parts.push(`${meta.created} added`);
      if (meta.skipped > 0) parts.push(`${meta.skipped} already on roster`);
      if (meta.invalid > 0) parts.push(`${meta.invalid} invalid (no email/phone)`);
      toast.success(parts.length > 0 ? parts.join(", ") : "No changes");
      setBulkImportKey((k) => k + 1);
      void qc.invalidateQueries({ queryKey: adminKeys.events.invitees(eventId) });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Import failed")),
  });

  const revokeMutation = useMutation({
    mutationFn: async (inviteeId: string) => {
      await api.post(`/admin/events/${eventId}/invitees/${inviteeId}/revoke`);
    },
    onSuccess: () => {
      toast.success("Invitee revoked");
      void qc.invalidateQueries({ queryKey: adminKeys.events.invitees(eventId) });
    },
  });

  const event = eventQuery.data;

  if (!eventId) {
    return <Navigate to="/events" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/events">← Events</Link>
        </Button>
        <h2 className="text-2xl font-semibold">{event?.title ?? "Event"}</h2>
        {event && (
          <Badge variant={event.status === "published" ? "default" : "secondary"}>
            {event.status}
          </Badge>
        )}
      </div>

      {eventQuery.isLoading && <p className="text-muted-foreground">Loading…</p>}

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
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {editing ? (
                  <EventForm
                    key={`${event.id}-${editing}`}
                    mode="update"
                    initialValues={eventToFormValues(event)}
                    isPending={updateMutation.isPending}
                    onCancel={() => setEditing(false)}
                    onSubmit={(values) =>
                      updateMutation.mutate(formValuesToUpdatePayload(values))
                    }
                  />
                ) : (
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Slug:</span> {event.slug}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Access:</span>{" "}
                      {event.accessMode}
                    </p>
                    {event.accessMode === "public" ? (
                      <p className="text-muted-foreground">
                        Invites and roster are not used for public events.
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
                  onImport={(invitees) => upsertMutation.mutate(invitees)}
                />

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invite link</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(inviteesQuery.data ?? []).map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          {inv.person.givenName} {inv.person.familyName}
                        </TableCell>
                        <TableCell>{inv.person.email ?? "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {inv.notes ?? "—"}
                        </TableCell>
                        <TableCell>
                          {inv.revokedAt
                            ? "Revoked"
                            : inv.profilePending
                              ? "Profile pending"
                              : "Active"}
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          <InviteeLinkActions
                            eventId={eventId}
                            eventSlug={event.slug}
                            defaultMaxRedemptions={event.defaultInviteLinkMaxRedemptions}
                            invitee={inv}
                            revoked={Boolean(inv.revokedAt)}
                          />
                        </TableCell>
                        <TableCell className="space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditInvitee(inv)}
                          >
                            Edit
                          </Button>
                          {!inv.revokedAt && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => revokeMutation.mutate(inv.id)}
                              >
                                Revoke
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
