import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { EventForm } from "@/components/event-form";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/hooks/use-admin-api";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  emptyEventFormValues,
  formValuesToCreatePayload,
} from "@/lib/event-form-utils";

export function EventFormPage() {
  const navigate = useNavigate();
  const createMutation = useMutation(adminApi.event.create());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild size="sm" variant="ghost">
          <Link to="/events">← Events</Link>
        </Button>
        <h2 className="text-2xl font-semibold">New event</h2>
      </div>

      <EventForm
        initialValues={emptyEventFormValues()}
        isPending={createMutation.isPending}
        mode="create"
        onSubmit={(values) =>
          createMutation.mutate(formValuesToCreatePayload(values), {
            onSuccess: (item) => {
              toast.success("Event created");
              void navigate(`/events/${item.id}`);
            },
            onError: (err) =>
              toast.error(getApiErrorMessage(err, "Failed to create event")),
          })
        }
      />
    </div>
  );
}
