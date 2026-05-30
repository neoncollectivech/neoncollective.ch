import type { EventInviteeListRow } from "@/lib/admin-api";
import type { InviteeUpsertPayload } from "@/lib/parse-invitees-csv";
import type { InviteeOrderStatusFilterValue } from "@/lib/invitee-order-status-filter";

import { useMutation } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AdminDataTable } from "@/components/admin-data-table";
import { eventInviteesColumns } from "@/components/admin-data-table/columns/event-invitees-columns";
import { EventInviteesTableToolbar } from "@/components/event-invitees-table-toolbar";
import { EditInviteeDialog } from "@/components/invitee-dialogs";
import { InviteExistingPeopleDialog } from "@/components/invite-existing-people-dialog";
import { InviteeBulkImport } from "@/components/invitee-bulk-import";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "@/hooks/use-admin-api";
import { useEventIdParam } from "@/hooks/use-event-id-param";
import { useEventWorkspaceQueries } from "@/hooks/use-event-workspace-queries";
import { exportEventInviteesCsv } from "@/lib/admin-api";
import { downloadBlob } from "@/lib/download-blob";
import { eventInviteesListService } from "@/lib/admin-list-services";
import { toAdminSortParam } from "@/lib/admin-list-sort";
import { eventOverviewPath } from "@/lib/event-workspace-paths";

export function EventInviteesPage() {
  const { eventId } = useEventIdParam();
  const { event, isLoading } = useEventWorkspaceQueries(eventId);
  const [addInviteeOpen, setAddInviteeOpen] = useState(false);
  const [editInvitee, setEditInvitee] = useState<EventInviteeListRow | null>(
    null,
  );
  const [bulkImportKey, setBulkImportKey] = useState(0);
  const [orderStatusFilter, setOrderStatusFilter] =
    useState<InviteeOrderStatusFilterValue>("");
  const [exportingCsv, setExportingCsv] = useState(false);
  const inviteeSortRef = useRef("personId");

  const upsertMutation = useMutation(adminApi.event.upsertInvitees(eventId));
  const revokeMutation = useMutation(adminApi.event.revokeInvitee(eventId));

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

  if (isLoading && !event) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!event) {
    return <p className="text-muted-foreground">Event not found.</p>;
  }

  if (event.accessMode !== "invite_only") {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Invitees</h2>
        <p className="text-sm text-muted-foreground">
          Public events do not use an invite list. Switch to invite-only access
          in settings if you need invitees.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link to={eventOverviewPath(eventId)}>Back to overview</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Invitees</h2>
        <Button size="sm" onClick={() => setAddInviteeOpen(true)}>
          Add invitee
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite list</CardTitle>
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
                  const { blob, filename } = await exportEventInviteesCsv(
                    eventId,
                    {
                      orderStatus: orderStatusFilter || undefined,
                      sort: inviteeSortRef.current,
                    },
                  );

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

                  if (meta.created > 0) parts.push(`${meta.created} added`);
                  if (meta.skipped > 0)
                    parts.push(`${meta.skipped} already invited`);
                  if (meta.invalid > 0)
                    parts.push(`${meta.invalid} invalid (no email/phone)`);
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

      <InviteExistingPeopleDialog
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
