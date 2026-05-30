import type { EventInviteeListRow } from "@/lib/admin-api";

import { Badge } from "@/components/ui/badge";

export function InviteeStatusBadge({
  invitee,
}: {
  invitee: EventInviteeListRow;
}) {
  if (invitee.revokedAt) {
    return <Badge variant="secondary">Revoked</Badge>;
  }

  if (!invitee.personId) {
    return <Badge variant="secondary">Profile pending</Badge>;
  }

  return <Badge>Active</Badge>;
}
