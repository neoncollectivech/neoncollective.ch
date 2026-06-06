import { useMutation, useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";

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
import { EventWorkspaceGate } from "@/components/layout/event-workspace-gate";
import { adminApi } from "@/hooks/use-admin-api";
import {
  useAdmissionIdParam,
  useEventIdParam,
} from "@/hooks/use-event-id-param";
import { getApiErrorMessage } from "@/lib/api-error";
import { eventWorkspaceSectionPath } from "@/lib/event-workspace-paths";

function AdmissionDetailContent({
  eventId,
  admissionId,
}: {
  eventId: string;
  admissionId: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const admissionQuery = useQuery(adminApi.admission.detail(admissionId));
  const cancelCheckInMutation = useMutation(
    adminApi.admission.cancelCheckIn(admissionId),
  );

  const admission = admissionQuery.data;
  const guestLabel = admission
    ? `${admission.givenName} ${admission.familyName}`.trim()
    : "";

  const canCancelCheckIn = Boolean(
    admission?.checkedInAt && !admission?.revokedAt,
  );

  useEffect(() => {
    if (!admission || admission.eventId === eventId) {
      return;
    }
    toast.error("Admission belongs to a different event");
  }, [admission, eventId]);

  if (admissionQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <InlineSpinner />
        Loading admission…
      </p>
    );
  }

  if (admissionQuery.isError || !admission) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">Admission not found.</p>
        <Button asChild variant="outline">
          <Link to={eventWorkspaceSectionPath(eventId, "admissions")}>
            Back to admissions
          </Link>
        </Button>
      </div>
    );
  }

  if (admission.eventId !== eventId) {
    return (
      <Navigate replace to={eventWorkspaceSectionPath(eventId, "admissions")} />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to={eventWorkspaceSectionPath(eventId, "admissions")}>
            ← Admissions
          </Link>
        </Button>
      </div>

      <h2 className="text-2xl font-semibold">{guestLabel || "Admission"}</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guest</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              to={`/people/${admission.personId}`}
            >
              {guestLabel || admission.personId}
            </Link>
          </p>
          <p>
            Registration:{" "}
            <span className="font-mono">{admission.registrationId}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Check-in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Status:{" "}
            {admission.revokedAt
              ? "Revoked"
              : admission.checkedInAt
                ? "Checked in"
                : "Not checked in"}
          </p>
          {admission.checkedInAt ? (
            <p>
              At: {new Date(admission.checkedInAt).toLocaleString()}
              {admission.checkedInBy ? (
                <>
                  <br />
                  By: <span className="font-mono">{admission.checkedInBy}</span>
                </>
              ) : null}
            </p>
          ) : null}
          {admission.revokedAt ? (
            <p>Revoked: {new Date(admission.revokedAt).toLocaleString()}</p>
          ) : null}
          <p>Created: {new Date(admission.createdAt).toLocaleString()}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credential</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          <div className="inline-block rounded-lg border border-border bg-white p-4">
            <QRCodeSVG
              aria-label="Admission credential QR code"
              bgColor="#ffffff"
              fgColor="#000000"
              level="L"
              size={240}
              value={admission.signedCredential}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            High-contrast code for door scanners (same JWT as Copy JWT).
          </p>
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(admission.signedCredential);
              toast.success("Credential copied");
            }}
          >
            Copy JWT
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {canCancelCheckIn ? (
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Cancel check-in
          </Button>
        ) : null}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel check-in</DialogTitle>
            <DialogDescription>
              Clear check-in for {guestLabel || "this guest"}? They can be
              checked in again with the same credential.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Keep check-in
            </Button>
            <Button
              disabled={cancelCheckInMutation.isPending}
              variant="destructive"
              onClick={() =>
                cancelCheckInMutation.mutate(undefined, {
                  onSuccess: () => {
                    setConfirmOpen(false);
                    toast.success("Check-in cancelled");
                  },
                  onError: (err) =>
                    toast.error(
                      getApiErrorMessage(err, "Failed to cancel check-in"),
                    ),
                })
              }
            >
              Cancel check-in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdmissionDetailPage() {
  const { eventId } = useEventIdParam();
  const { admissionId, isValid: admissionIdValid } = useAdmissionIdParam();

  if (!admissionIdValid) {
    return (
      <Navigate replace to={eventWorkspaceSectionPath(eventId, "admissions")} />
    );
  }

  return (
    <EventWorkspaceGate eventId={eventId}>
      {(ctx) => (
        <AdmissionDetailContent
          admissionId={admissionId}
          eventId={ctx.event.id}
        />
      )}
    </EventWorkspaceGate>
  );
}
