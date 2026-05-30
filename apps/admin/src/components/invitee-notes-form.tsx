import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { adminApi } from "@/hooks/use-admin-api";

type InviteeNotesFormProps = {
  eventId: string;
  inviteeId: string;
  initialNotes: string | null;
  onSaved?: () => void;
};

export function InviteeNotesForm({
  eventId,
  inviteeId,
  initialNotes,
  onSaved,
}: InviteeNotesFormProps) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const mutation = useMutation(adminApi.event.updateInvitee(eventId));

  useEffect(() => {
    setNotes(initialNotes ?? "");
  }, [initialNotes, inviteeId]);

  return (
    <div className="space-y-3">
      <FormField label="Notes">
        <Textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </FormField>
      <Button
        disabled={mutation.isPending}
        size="sm"
        onClick={() => {
          mutation.mutate(
            {
              inviteeId,
              notes: notes.trim() || null,
            },
            {
              onSuccess: () => {
                toast.success("Invitee updated");
                onSaved?.();
              },
            },
          );
        }}
      >
        {mutation.isPending ? "Saving…" : "Save notes"}
      </Button>
    </div>
  );
}
