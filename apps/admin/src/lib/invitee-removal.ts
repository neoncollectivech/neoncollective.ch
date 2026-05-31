import type { EventInviteeListRow, OrderRow } from "@/lib/admin-api";
import type { ForeignKeyLookupRow } from "@/lib/admin-fk-services";

export type InviteeRemovalAction = "delete" | "revoke";

export function inviteeRemovalAction(
  invitee: EventInviteeListRow,
  orderLookup?: Map<string, ForeignKeyLookupRow>,
): InviteeRemovalAction {
  if (!invitee.personId) {
    return "delete";
  }

  const order = orderLookup?.get(invitee.personId) as OrderRow | undefined;

  if (!order) {
    return "delete";
  }

  return "revoke";
}
