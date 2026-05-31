import type { EventInviteeListRow } from "@/lib/admin-api";
import type { UseForeignKeyResult } from "@/hooks/use-foreign-key";

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
  if (invitee.revokedAt) {
    return null;
  }

  const action = inviteeRemovalAction(invitee, fk?.lookups.order);

  if (action === "delete") {
    return (
      <Button
        disabled={deletePending}
        size="sm"
        variant="outline"
        onClick={() => {
          if (
            !confirm(
              "Delete this invitee from the list? This cannot be undone.",
            )
          ) {
            return;
          }
          onDelete(invitee.id);
        }}
      >
        Delete
      </Button>
    );
  }

  return (
    <Button
      disabled={revokePending}
      size="sm"
      variant="outline"
      onClick={() => onRevoke(invitee.id)}
    >
      Revoke
    </Button>
  );
}
