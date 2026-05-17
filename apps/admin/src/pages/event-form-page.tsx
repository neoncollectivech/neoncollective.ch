import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { EventForm } from "@/components/event-form";
import { Button } from "@/components/ui/button";
import { api, type ItemResponse } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";
import type { EventDetail } from "@/lib/admin-types";
import { emptyEventFormValues, formValuesToCreatePayload } from "@/lib/event-form-utils";
import { adminKeys } from "@/lib/query-keys";

export function EventFormPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof formValuesToCreatePayload>) => {
      const res = await api.post<ItemResponse<EventDetail>>("/admin/events", payload);
      return res.data.item;
    },
    onSuccess: (item) => {
      toast.success("Event created");
      void qc.invalidateQueries({ queryKey: adminKeys.events.all });
      void navigate(`/events/${item.id}`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to create event")),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/events">← Events</Link>
        </Button>
        <h2 className="text-2xl font-semibold">New event</h2>
      </div>

      <EventForm
        mode="create"
        initialValues={emptyEventFormValues()}
        isPending={createMutation.isPending}
        onSubmit={(values) => createMutation.mutate(formValuesToCreatePayload(values))}
      />
    </div>
  );
}
