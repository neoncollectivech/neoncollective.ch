import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";
import type { InviteeEditForm, InviteeRow, InviteeUpsertForm } from "@/lib/admin-types";
import { adminKeys } from "@/lib/query-keys";

const emptyUpsertForm = (): InviteeUpsertForm => ({
  givenName: "",
  familyName: "",
  email: "",
  phoneE164: "",
  notes: "",
});

type AddInviteeDialogProps = {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddInviteeDialog({ eventId, open, onOpenChange }: AddInviteeDialogProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyUpsertForm);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{
        results: { status: "created" | "skipped" }[];
      }>(`/admin/events/${eventId}/invitees`, {
        invitees: [
          {
            givenName: form.givenName.trim(),
            familyName: form.familyName.trim(),
            email: form.email.trim() || null,
            phoneE164: form.phoneE164.trim() || null,
            notes: form.notes.trim() || null,
            maxRedemptions: null,
          },
        ],
      });
      return res.data.results[0]?.status ?? "created";
    },
    onSuccess: (status) => {
      toast.success(
        status === "skipped" ? "Already on the roster" : "Invitee added",
      );
      void qc.invalidateQueries({ queryKey: adminKeys.events.invitees(eventId) });
      setForm(emptyUpsertForm());
      setError(null);
      onOpenChange(false);
    },
    onError: (err) => {
      const msg = getApiErrorMessage(err, "Failed to add invitee");
      setError(msg);
      toast.error(msg);
    },
  });

  const set = <K extends keyof InviteeUpsertForm>(key: K, value: InviteeUpsertForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add invitee</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Given name">
              <Input value={form.givenName} onChange={(e) => set("givenName", e.target.value)} />
            </FormField>
            <FormField label="Family name">
              <Input value={form.familyName} onChange={(e) => set("familyName", e.target.value)} />
            </FormField>
          </div>
          <FormField label="Email">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </FormField>
          <FormField label="Phone (E.164)">
            <Input
              value={form.phoneE164}
              onChange={(e) => set("phoneE164", e.target.value)}
              placeholder="+41791234567"
            />
          </FormField>
          <FormField label="Notes">
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </FormField>
          <p className="text-xs text-muted-foreground">
            Email or phone required. Create or copy the host invite link from the Invite link
            column after the person is on the roster.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || (!form.email.trim() && !form.phoneE164.trim())}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EditInviteeDialogProps = {
  eventId: string;
  invitee: InviteeRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditInviteeDialog({
  eventId,
  invitee,
  open,
  onOpenChange,
}: EditInviteeDialogProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<InviteeEditForm>({ notes: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!invitee) return;
      await api.patch(`/admin/events/${eventId}/invitees/${invitee.id}`, {
        notes: form.notes.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Invitee updated");
      void qc.invalidateQueries({ queryKey: adminKeys.events.invitees(eventId) });
      onOpenChange(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update invitee")),
  });

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
              {invitee.person.givenName} {invitee.person.familyName}
              {invitee.person.email ? ` · ${invitee.person.email}` : ""}
            </p>
            <FormField label="Notes">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </FormField>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
