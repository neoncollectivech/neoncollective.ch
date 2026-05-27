import type { InviteeEditForm } from "@/lib/admin-types";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { adminApi } from "@/hooks/use-admin-api";

type EditInviteeListRow = {
  id: string;
  notes: string | null;
  email: string | null;
  phone: string | null;
};

type EditInviteeDialogProps = {
  eventId: string;
  invitee: EditInviteeListRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditInviteeDialog({
  eventId,
  invitee,
  open,
  onOpenChange,
}: EditInviteeDialogProps) {
  const [form, setForm] = useState<InviteeEditForm>({ notes: "" });
  const mutation = useMutation(adminApi.event.updateInvitee(eventId));

  useEffect(() => {
    if (open && invitee) {
      setForm({ notes: invitee.notes ?? "" });
    }
  }, [open, invitee]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit invitee</DialogTitle>
        </DialogHeader>
        {invitee && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {invitee.email ?? "—"}
              {invitee.phone ? ` · +${invitee.phone}` : ""}
            </p>
            <FormField label="Notes">
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </FormField>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || !invitee}
            onClick={() => {
              if (!invitee) return;
              mutation.mutate(
                {
                  inviteeId: invitee.id,
                  notes: form.notes.trim() || null,
                },
                {
                  onSuccess: () => {
                    toast.success("Invitee updated");
                    onOpenChange(false);
                  },
                },
              );
            }}
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
