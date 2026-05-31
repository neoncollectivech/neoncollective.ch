import type { EventInviteeListRow } from "@/lib/admin-api";
import type { UseForeignKeyResult } from "@/hooks/use-foreign-key";

import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AdminFkCell } from "@/components/admin-fk/admin-fk-cell";
import { InviteeLinkActions } from "@/components/invitee-link-actions";
import { InviteeNotesForm } from "@/components/invitee-notes-form";
import { InviteeRemovalActions } from "@/components/invitee-removal-actions";
import { InviteeStatusBadge } from "@/components/invitee-status-badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { adminApi } from "@/hooks/use-admin-api";
import { orderFkService, personFkService } from "@/lib/admin-fk-services";
import { displayName } from "@/lib/invitee-tree/display-label";

type InviteeTreeDetailPanelProps = {
  eventId: string;
  eventSlug: string;
  defaultInviteLinkMaxRedemptions: number;
  invitee: EventInviteeListRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fk: UseForeignKeyResult;
};

export function InviteeTreeDetailPanel({
  eventId,
  eventSlug,
  defaultInviteLinkMaxRedemptions,
  invitee,
  open,
  onOpenChange,
  fk,
}: InviteeTreeDetailPanelProps) {
  const revokeMutation = useMutation(adminApi.event.revokeInvitee(eventId));
  const deleteMutation = useMutation(adminApi.event.deleteInvitee(eventId));
  const personLookup = fk.lookups.person;

  if (!invitee) {
    return null;
  }

  const name = displayName(invitee, personLookup);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{name}</DrawerTitle>
          <DrawerDescription>
            {invitee.email ?? "—"}
            {invitee.phone ? ` · +${invitee.phone}` : ""}
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <InviteeStatusBadge invitee={invitee} />
            {invitee.personId ? (
              <Button asChild size="sm" variant="outline">
                <Link to={`/people/${invitee.personId}`}>View person</Link>
              </Button>
            ) : null}
          </div>

          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">Invited by</p>
            <AdminFkCell
              fk={fk}
              fkService={personFkService}
              foreignDisplayField={["givenName", "familyName"]}
              foreignId={invitee.inviterId}
            />
          </div>

          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">Order</p>
            <AdminFkCell
              fk={fk}
              fkService={orderFkService}
              foreignDisplayField="status"
              foreignId={invitee.personId}
              presentation="badge"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Invite link</p>
            <InviteeLinkActions
              defaultMaxRedemptions={defaultInviteLinkMaxRedemptions}
              eventId={eventId}
              eventSlug={eventSlug}
              inviteeId={invitee.id}
              personId={invitee.personId}
              revoked={Boolean(invitee.revokedAt)}
            />
          </div>

          <InviteeNotesForm
            eventId={eventId}
            initialNotes={invitee.notes}
            inviteeId={invitee.id}
          />

          <InviteeRemovalActions
            deletePending={deleteMutation.isPending}
            fk={fk}
            invitee={invitee}
            revokePending={revokeMutation.isPending}
            onDelete={(inviteeId) => {
              deleteMutation.mutate(inviteeId, {
                onSuccess: () => {
                  toast.success("Invitee deleted");
                  onOpenChange(false);
                },
              });
            }}
            onRevoke={(inviteeId) => {
              revokeMutation.mutate(inviteeId, {
                onSuccess: () => {
                  toast.success("Invitee revoked");
                  onOpenChange(false);
                },
              });
            }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
