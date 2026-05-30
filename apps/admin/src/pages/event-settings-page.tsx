import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { EventForm } from "@/components/event-form";
import { EventWorkspaceGate } from "@/components/layout/event-workspace-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "@/hooks/use-admin-api";
import { useEventIdParam } from "@/hooks/use-event-id-param";
import {
  eventToFormValues,
  formValuesToUpdatePayload,
} from "@/lib/event-form-utils";

export function EventSettingsPage() {
  const { eventId } = useEventIdParam();
  const updateMutation = useMutation(adminApi.event.update(eventId));

  return (
    <EventWorkspaceGate eventId={eventId}>
      {({ event }) => (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">Settings</h2>

          <Card>
            <CardHeader>
              <CardTitle>Event details</CardTitle>
            </CardHeader>
            <CardContent>
              <EventForm
                key={event.id}
                initialValues={eventToFormValues(event)}
                isPending={updateMutation.isPending}
                mode="update"
                onSubmit={(values) =>
                  updateMutation.mutate(formValuesToUpdatePayload(values), {
                    onSuccess: () => toast.success("Event updated"),
                  })
                }
              />
            </CardContent>
          </Card>
        </div>
      )}
    </EventWorkspaceGate>
  );
}
