import type { EventInviteeListRow, OrderRow } from "@/lib/admin-api";
import type { ForeignKeyLookupRow } from "@/lib/admin-fk-services";

export type InviteeVisualStatus =
  | "revoked"
  | "profile_pending"
  | "active"
  | "paid"
  | "pending"
  | "failed"
  | "refunded"
  | "no_order";

export function inviteeVisualStatus(
  invitee: EventInviteeListRow,
  orderLookup: Map<string, ForeignKeyLookupRow> | undefined,
): InviteeVisualStatus {
  if (invitee.revokedAt) {
    return "revoked";
  }

  if (!invitee.personId) {
    return "profile_pending";
  }

  const order = invitee.personId
    ? (orderLookup?.get(invitee.personId) as OrderRow | undefined)
    : undefined;

  if (!order) {
    return "no_order";
  }

  if (
    order.status === "paid" ||
    order.status === "pending" ||
    order.status === "failed" ||
    order.status === "refunded"
  ) {
    return order.status;
  }

  return "active";
}

export function statusRingClass(status: InviteeVisualStatus): string {
  switch (status) {
    case "paid":
      return "ring-green-500";
    case "pending":
      return "ring-yellow-500";
    case "failed":
      return "ring-red-500";
    case "refunded":
      return "ring-orange-500";
    case "revoked":
      return "ring-muted-foreground";
    case "profile_pending":
      return "ring-muted-foreground";
    case "no_order":
      return "ring-border";
    default:
      return "ring-primary";
  }
}
