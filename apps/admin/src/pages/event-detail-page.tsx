import type { EventInviteeListRow } from "@/lib/admin-api";
import type { EventDetail } from "@/lib/admin-types";
import type { InviteeUpsertPayload } from "@/lib/parse-invitees-csv";
import type { InviteeOrderStatusFilterValue } from "@/lib/invitee-order-status-filter";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";

import { AdminDataTable } from "@/components/admin-data-table";
import { eventInviteesColumns } from "@/components/admin-data-table/columns/event-invitees-columns";
import { EventInviteesTableToolbar } from "@/components/event-invitees-table-toolbar";
import { EventCapacityStats } from "@/components/event-capacity-stats";
import { EventForm } from "@/components/event-form";
import {
  AddInviteeDialog,
  EditInviteeDialog,
} from "@/components/invitee-dialogs";
import { InviteeBulkImport } from "@/components/invitee-bulk-import";
import { TierEditor } from "@/components/tier-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  eventToFormValues,
  formValuesToUpdatePayload,
} from "@/lib/event-form-utils";
import { adminApi } from "@/hooks/use-admin-api";
import { useUuidRouteParam } from "@/hooks/use-uuid-route-param";
import { exportEventInviteesCsv } from "@/lib/admin-api";
import { downloadBlob } from "@/lib/download-blob";
import { eventInviteesListService } from "@/lib/admin-list-services";
import { toAdminSortParam } from "@/lib/admin-list-sort";

export function EventDetailPage() {
  const { id: eventId, isValid } = useUuidRouteParam();
  const [editing, setEditing] = useState(false);
  const [addInviteeOpen, setAddInviteeOpen] = useState(false);
  const [editInvitee, setEditInvitee] = useState<EventInviteeListRow | null>(
    null,
  );
  const [bulkImportKey, setBulkImportKey] = useState(0);
  const [orderStatusFilter, setOrderStatusFilter] =
    useState<InviteeOrderStatusFilterValue>("");
  const [exportingCsv, setExportingCsv] = useState(false);
  const inviteeSortRef = useRef("personId");

  const eventQuery = useQuery(adminApi.event.detail(eventId));
  const tiersQuery = useQuery(adminApi.event.tiers(eventId));
  const capacityQuery = useQuery(adminApi.event.capacityUsage(eventId));
  const updateMutation = useMutation(adminApi.event.update(eventId));
  const upsertMutation = useMutation(adminApi.event.upsertInvitees(eventId));
  const revokeMutation = useMutation(adminApi.event.revokeInvitee(eventId));

  const event = eventQuery.data;
  const tiers = tiersQuery.data?.items ?? [];
  const capacity = event
    ? {
        used: capacityQuery.data?.used ?? 0,
        remaining:
          event.eventQuota != null
            ? Math.max(0, event.eventQuota - (capacityQuery.data?.used ?? 0))
            : null,
      }
    : undefined;

  const inviteeColumns = useMemo(
    () =>
      event
        ? eventInviteesColumns({
            eventId,
            eventSlug: event.slug,
            defaultInviteLinkMaxRedemptions:
              event.defaultInviteLinkMaxRedemptions,
            onEdit: setEditInvitee,
            onRevoke: (inviteeId) => {
              revokeMutation.mutate(inviteeId, {
                onSuccess: () => toast.success("Invitee revoked"),
              });
            },
          })
        : [],
    [event, eventId, revokeMutation],
  );

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
                    initialValues={eventToFormValues({
                      ...event,
                      status: event.status as EventDetail["status"],
                      accessMode: event.accessMode as EventDetail["accessMode"],
                    })}
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
                      capacity={capacity}
                      eventQuota={event.eventQuota}
                      tiers={tiers}
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
                <TierEditor eventId={eventId} tiers={tiers} />
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
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      disabled={exportingCsv}
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        setExportingCsv(true);
                        try {
                          const { blob, filename } =
                            await exportEventInviteesCsv(eventId, {
                              orderStatus: orderStatusFilter || undefined,
                              sort: inviteeSortRef.current,
                            });

                          downloadBlob(blob, filename);
                          toast.success("CSV downloaded.");
                        } catch (e) {
                          const message =
                            e instanceof Error ? e.message : "Export failed.";

                          toast.error(
                            message.includes("narrow filters")
                              ? "Too many invitees — narrow filters and try again."
                              : message,
                          );
                        } finally {
                          setExportingCsv(false);
                        }
                      }}
                    >
                      {exportingCsv ? "Exporting…" : "Export CSV"}
                    </Button>
                  </div>

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

                  <AdminDataTable
                    columns={inviteeColumns}
                    enabled={Boolean(event)}
                    filters={{
                      orderStatus: orderStatusFilter || undefined,
                    }}
                    fkScope={{ eventId }}
                    scope={{ eventId }}
                    service={eventInviteesListService}
                    toolbar={(ctx) => {
                      inviteeSortRef.current = toAdminSortParam(
                        ctx.sortField,
                        ctx.sortDirection,
                      );

                      return (
                        <EventInviteesTableToolbar
                          ctx={ctx}
                          orderStatusFilter={orderStatusFilter}
                          onOrderStatusFilterChange={setOrderStatusFilter}
                        />
                      );
                    }}
                  />
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
