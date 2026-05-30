import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InviteeNotesForm } from "@/components/invitee-notes-form";

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
            <InviteeNotesForm
              eventId={eventId}
              initialNotes={invitee.notes}
              inviteeId={invitee.id}
              onSaved={() => onOpenChange(false)}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
