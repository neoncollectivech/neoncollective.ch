import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { EventForm } from "@/components/event-form";
import { adminApi } from "@/hooks/use-admin-api";
import { getApiErrorMessage } from "@/lib/api-error";
import { eventOverviewPath } from "@/lib/event-workspace-paths";
import {
  emptyEventFormValues,
  formValuesToCreatePayload,
} from "@/lib/event-form-utils";

export function EventFormPage() {
  const navigate = useNavigate();
  const createMutation = useMutation(adminApi.event.create());

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">New event</h2>

      <EventForm
        initialValues={emptyEventFormValues()}
        isPending={createMutation.isPending}
        mode="create"
        onSubmit={(values) =>
          createMutation.mutate(formValuesToCreatePayload(values), {
            onSuccess: (item) => {
              toast.success("Event created");
              void navigate(eventOverviewPath(item.id));
            },
            onError: (err) =>
              toast.error(getApiErrorMessage(err, "Failed to create event")),
          })
        }
      />
    </div>
  );
}
