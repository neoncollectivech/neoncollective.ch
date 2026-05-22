import type { EventInviteeListRow } from "@/lib/admin-api";
import type { AdminColumnDef } from "@/components/admin-data-table/types";

import {
  adminActionsColumn,
  adminFkColumn,
  adminTextColumn,
} from "@/components/admin-data-table/column-helpers";
import { InviteeLinkActions } from "@/components/invitee-link-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { orderFkService, personFkService } from "@/lib/admin-fk-services";

export type EventInviteesColumnsOptions = {
  eventId: string;
  eventSlug: string;
  defaultInviteLinkMaxRedemptions: number;
  onEdit: (invitee: EventInviteeListRow) => void;
  onRevoke: (inviteeId: string) => void;
};

export function eventInviteesColumns(
  opts: EventInviteesColumnsOptions,
): AdminColumnDef<EventInviteeListRow>[] {
  return [
    adminFkColumn("personId", {
      header: "Person",
      fk: personFkService,
      display: ["givenName", "familyName"],
      sortable: true,
    }),
    adminFkColumn("personId", {
      header: "Order",
      fk: orderFkService,
      display: "status",
    }),
    adminTextColumn("notes", {
      header: "Notes",
      sortable: true,
      className: "max-w-[200px] truncate",
    }),
    {
      id: "inviteeStatus",
      accessorKey: "revokedAt",
      header: "Status",
      enableSorting: true,
      meta: { sortable: true },
      cell: ({ row }) => {
        const inv = row.original;

        if (inv.revokedAt) {
          return <Badge variant="secondary">Revoked</Badge>;
        }
        if (!inv.personId) {
          return <Badge variant="secondary">Profile pending</Badge>;
        }

        return <Badge>Active</Badge>;
      },
    },
    {
      id: "inviteLink",
      header: "Invite link",
      enableSorting: false,
      cell: ({ row }) => {
        const inv = row.original;

        return (
          <InviteeLinkActions
            defaultMaxRedemptions={opts.defaultInviteLinkMaxRedemptions}
            eventId={opts.eventId}
            eventSlug={opts.eventSlug}
            inviteeId={inv.id}
            personId={inv.personId}
            revoked={Boolean(inv.revokedAt)}
          />
        );
      },
    },
    adminActionsColumn({
      cell: ({ row }) => {
        const inv = row.original;

        return (
          <div className="space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => opts.onEdit(inv)}
            >
              Edit
            </Button>
            {!inv.revokedAt ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => opts.onRevoke(inv.id)}
              >
                Revoke
              </Button>
            ) : null}
          </div>
        );
      },
    }),
  ];
}
