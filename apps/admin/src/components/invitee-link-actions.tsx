import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { adminApi } from "@/hooks/use-admin-api";
import { buildPublicInviteUrl } from "@/lib/invite-url";

type InviteeLinkActionsProps = {
  eventId: string;
  eventSlug: string;
  defaultMaxRedemptions: number;
  inviteeId: string;
  personId: string | null;
  revoked: boolean;
};

async function copyInviteUrl(slug: string, token: string) {
  const url = buildPublicInviteUrl(slug, token);

  await navigator.clipboard.writeText(url);
  toast.success("Invite link copied");
}

export function InviteeLinkActions({
  eventId,
  eventSlug,
  defaultMaxRedemptions,
  inviteeId,
  personId,
  revoked,
}: InviteeLinkActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [maxRedemptionsInput, setMaxRedemptionsInput] = useState("");
  const [regenerateMaxInput, setRegenerateMaxInput] = useState("");

  const { data: invitee, isLoading } = useQuery(
    adminApi.event.inviteeDetail(inviteeId),
  );

  const ensureMutation = useMutation(adminApi.event.ensureInviteeLink(eventId));
  const patchMutation = useMutation(adminApi.event.patchInviteLink(eventId));
  const deleteMutation = useMutation(adminApi.event.deleteInviteLink(eventId));
  const regenerateMutation = useMutation(
    adminApi.event.regenerateInviteeLink(eventId),
  );

  if (revoked) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  if (!personId) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title="Person profile must be linked first"
      >
        Profile pending
      </span>
    );
  }

  if (isLoading) {
    return <span className="text-xs text-muted-foreground">Loading…</span>;
  }

  if (!invitee) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  if (invitee.profilePending) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title="Person profile must be linked first"
      >
        Profile pending
      </span>
    );
  }

  const link = invitee.hostInviteLink;
  const canDelete = link != null && link.usedRedemptions === 0;

  if (!link) {
    return (
      <Button
        disabled={ensureMutation.isPending}
        size="sm"
        variant="outline"
        onClick={() =>
          ensureMutation.mutate(inviteeId, {
            onSuccess: async (token) => {
              toast.success("Invite link created");
              await copyInviteUrl(eventSlug, token);
            },
          })
        }
      >
        {ensureMutation.isPending ? "Creating…" : "Create link"}
      </Button>
    );
  }

  const openEdit = () => {
    setMaxRedemptionsInput(String(link.maxRedemptions));
    setEditOpen(true);
  };

  const openRegenerate = () => {
    setRegenerateMaxInput("");
    setRegenerateOpen(true);
  };

  return (
    <div className="space-y-1.5 text-xs">
      <p className="text-muted-foreground">
        <span className="text-foreground">{link.remainingRedemptions}</span>{" "}
        left · {link.usedRedemptions}/{link.maxRedemptions} used
      </p>
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void copyInviteUrl(eventSlug, link.token)}
        >
          Copy link
        </Button>
        <Button size="sm" variant="outline" onClick={openEdit}>
          Edit cap
        </Button>
        <Button size="sm" variant="ghost" onClick={openRegenerate}>
          Regenerate
        </Button>
        {canDelete ? (
          <Button
            disabled={deleteMutation.isPending}
            size="sm"
            variant="ghost"
            onClick={() => {
              if (
                !window.confirm(
                  "Delete this invite link? The URL will stop working. This cannot be undone.",
                )
              ) {
                return;
              }
              deleteMutation.mutate(link.id, {
                onSuccess: () => toast.success("Invite link deleted"),
              });
            }}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        ) : null}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit redemption cap</DialogTitle>
          </DialogHeader>
          <FormField label="Max guest redemptions">
            <Input
              min={link.usedRedemptions}
              type="number"
              value={maxRedemptionsInput}
              onChange={(e) => setMaxRedemptionsInput(e.target.value)}
            />
          </FormField>
          <p className="text-xs text-muted-foreground">
            Cannot be below {link.usedRedemptions} (already used or pending).
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={patchMutation.isPending}
              onClick={() => {
                const n = Number(maxRedemptionsInput);

                if (Number.isNaN(n) || n < 0) {
                  toast.error("Enter a valid number");

                  return;
                }
                if (n < link.usedRedemptions) {
                  toast.error(`Must be at least ${link.usedRedemptions}`);

                  return;
                }
                const linkId = link.id;

                patchMutation.mutate(
                  { linkId, maxRedemptions: n },
                  {
                    onSuccess: () => {
                      toast.success("Redemption cap updated");
                      setEditOpen(false);
                    },
                  },
                );
              }}
            >
              {patchMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate invite link</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The current URL will stop working. A new link will be copied to your
            clipboard.
          </p>
          <FormField label="Max guest redemptions (optional)">
            <Input
              min={0}
              placeholder={String(defaultMaxRedemptions)}
              type="number"
              value={regenerateMaxInput}
              onChange={(e) => setRegenerateMaxInput(e.target.value)}
            />
          </FormField>
          <p className="text-xs text-muted-foreground">
            Leave blank to use event default ({defaultMaxRedemptions}).
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={regenerateMutation.isPending}
              variant="destructive"
              onClick={() => {
                const trimmed = regenerateMaxInput.trim();
                const maxRedemptions =
                  trimmed && !Number.isNaN(Number(trimmed))
                    ? Number(trimmed)
                    : undefined;

                regenerateMutation.mutate(
                  { inviteeId, maxRedemptions },
                  {
                    onSuccess: async (token) => {
                      toast.success("Invite link regenerated");
                      setRegenerateOpen(false);
                      await copyInviteUrl(eventSlug, token);
                    },
                  },
                );
              }}
            >
              {regenerateMutation.isPending ? "Regenerating…" : "Regenerate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
