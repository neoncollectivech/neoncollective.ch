import type { AdmissionRow } from "@/lib/admin-api";
import type { ColumnDef } from "@tanstack/react-table";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

import { AdminDataTable } from "@/components/admin-data-table";
import { EventWorkspaceGate } from "@/components/layout/event-workspace-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { adminApi } from "@/hooks/use-admin-api";
import { useEventIdParam } from "@/hooks/use-event-id-param";
import { admissionsListService } from "@/lib/admin-list-services";
import { getApiErrorMessage } from "@/lib/api-error";
import { eventOrderPath, eventOrdersPath } from "@/lib/event-workspace-paths";

function admissionColumns(eventId: string): ColumnDef<AdmissionRow>[] {
  return [
    {
      accessorKey: "orderId",
      header: "Order",
      cell: ({ row }) => (
        <Link
          className="text-primary underline-offset-4 hover:underline"
          to={eventOrderPath(eventId, row.original.orderId)}
        >
          {row.original.orderId.slice(0, 8)}…
        </Link>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    {
      accessorKey: "checkedInAt",
      header: "Checked in",
      cell: ({ row }) =>
        row.original.checkedInAt
          ? new Date(row.original.checkedInAt).toLocaleString()
          : "—",
    },
    {
      id: "credential",
      header: "Credential",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(row.original.signedCredential);
            toast.success("Credential copied");
          }}
        >
          Copy JWT
        </Button>
      ),
    },
  ];
}

type EventAdmissionsContentProps = {
  eventId: string;
};

function EventAdmissionsContent({ eventId }: EventAdmissionsContentProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const summaryQuery = useQuery(adminApi.event.admissionsSummary(eventId));
  const provisionMutation = useMutation(
    adminApi.event.provisionAdmissionSigningKey(eventId),
  );
  const generateMutation = useMutation(
    adminApi.event.generateAdmissions(eventId),
  );

  const columns = useMemo(() => admissionColumns(eventId), [eventId]);

  const summary = summaryQuery.data;
  const eligible = summary?.eligibleWithoutAdmission ?? 0;
  const hasKey = Boolean(summary?.signingKey);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Admissions</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event signing key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {summaryQuery.isLoading ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <InlineSpinner />
              Loading…
            </p>
          ) : summary?.signingKey ? (
            <p className="text-muted-foreground">
              <span className="font-mono text-foreground">
                {summary.signingKey.kid}
              </span>
              {" · "}
              Created {new Date(summary.signingKey.createdAt).toLocaleString()}
              <br />
              <span className="text-xs">
                Created automatically with new events.
              </span>
            </p>
          ) : (
            <>
              <p className="text-amber-600 dark:text-amber-400">
                Missing signing key — usually created when the event was
                created.
              </p>
              <Button
                disabled={provisionMutation.isPending}
                onClick={() =>
                  provisionMutation.mutate(undefined, {
                    onSuccess: (data) => {
                      toast.success(
                        data.alreadyExists
                          ? "Signing key already exists"
                          : "Signing key created",
                      );
                      void summaryQuery.refetch();
                    },
                    onError: (err) =>
                      toast.error(
                        getApiErrorMessage(err, "Failed to create key"),
                      ),
                  })
                }
              >
                Create event signing key
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {summary ? (
        <p className="text-sm text-muted-foreground">
          Paid exclusive orders: {summary.paidExclusiveOrders} · With admission:{" "}
          {summary.withAdmission} · Eligible without admission: {eligible}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!hasKey || eligible === 0 || generateMutation.isPending}
          title={
            !hasKey
              ? "Create a signing key first"
              : eligible === 0
                ? "No paid orders need admissions"
                : undefined
          }
          onClick={() => setConfirmOpen(true)}
        >
          Generate missing admissions
        </Button>
        <Button asChild variant="outline">
          <Link to={eventOrdersPath(eventId)}>View orders</Link>
        </Button>
      </div>

      <AdminDataTable
        columns={columns}
        scope={{ eventId }}
        service={admissionsListService}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate admissions</DialogTitle>
            <DialogDescription>
              Issue JWT credentials for {eligible} paid order
              {eligible === 1 ? "" : "s"} without an admission row?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={generateMutation.isPending}
              onClick={() =>
                generateMutation.mutate(undefined, {
                  onSuccess: (data) => {
                    setConfirmOpen(false);
                    toast.success(
                      `Created ${data.created}, skipped ${data.skipped}, failed ${data.failed}`,
                    );
                    void summaryQuery.refetch();
                  },
                  onError: (err) =>
                    toast.error(getApiErrorMessage(err, "Generate failed")),
                })
              }
            >
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function EventAdmissionsPage() {
  const { eventId } = useEventIdParam();

  return (
    <EventWorkspaceGate eventId={eventId}>
      {(ctx) => <EventAdmissionsContent eventId={ctx.event.id} />}
    </EventWorkspaceGate>
  );
}
