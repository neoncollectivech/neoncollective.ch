import type { EventDetail } from "@/lib/admin-types";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { EventForm } from "@/components/event-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "@/hooks/use-admin-api";
import { useEventIdParam } from "@/hooks/use-event-id-param";
import { useEventWorkspaceQueries } from "@/hooks/use-event-workspace-queries";
import {
  eventToFormValues,
  formValuesToUpdatePayload,
} from "@/lib/event-form-utils";

export function EventSettingsPage() {
  const { eventId } = useEventIdParam();
  const { event, isLoading } = useEventWorkspaceQueries(eventId);
  const updateMutation = useMutation(adminApi.event.update(eventId));

  if (isLoading && !event) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!event) {
    return <p className="text-muted-foreground">Event not found.</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle>Event details</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm
            key={event.id}
            initialValues={eventToFormValues({
              ...event,
              status: event.status as EventDetail["status"],
              accessMode: event.accessMode as EventDetail["accessMode"],
            })}
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
  );
}
