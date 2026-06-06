import type { EventInviteeListRow } from "@/lib/admin-api";
import type { UseForeignKeyResult } from "@/hooks/use-foreign-key";

import { useConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { inviteeRemovalAction } from "@/lib/invitee-removal";

type InviteeRemovalActionsProps = {
  invitee: EventInviteeListRow;
  fk?: UseForeignKeyResult;
  deletePending?: boolean;
  revokePending?: boolean;
  onDelete: (inviteeId: string) => void;
  onRevoke: (inviteeId: string) => void;
};

export function InviteeRemovalActions({
  invitee,
  fk,
  deletePending = false,
  revokePending = false,
  onDelete,
  onRevoke,
}: InviteeRemovalActionsProps) {
  const { confirm, ConfirmDialog } = useConfirmDialog();

  if (invitee.revokedAt) {
    return null;
  }

  const action = inviteeRemovalAction(invitee, fk?.lookups.order);

  const button =
    action === "delete" ? (
      <Button
        disabled={deletePending}
        size="sm"
        variant="outline"
        onClick={() =>
          confirm({
            title: "Delete this invitee from the list?",
            description: "This cannot be undone.",
            confirmLabel: "Delete",
            variant: "destructive",
            onConfirm: () => onDelete(invitee.id),
          })
        }
      >
        Delete
      </Button>
    ) : (
      <Button
        disabled={revokePending}
        size="sm"
        variant="outline"
        onClick={() => onRevoke(invitee.id)}
      >
        Revoke
      </Button>
    );

  return (
    <>
      {button}
      <ConfirmDialog />
    </>
  );
}
