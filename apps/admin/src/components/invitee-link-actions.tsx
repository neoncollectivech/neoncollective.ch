import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { api } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";
import type { InviteeRow } from "@/lib/admin-types";
import { buildPublicInviteUrl } from "@/lib/invite-url";
import { adminKeys } from "@/lib/query-keys";

type InviteeLinkActionsProps = {
  eventId: string;
  eventSlug: string;
  defaultMaxRedemptions: number;
  invitee: InviteeRow;
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
  invitee,
  revoked,
}: InviteeLinkActionsProps) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [maxRedemptionsInput, setMaxRedemptionsInput] = useState("");
  const [regenerateMaxInput, setRegenerateMaxInput] = useState("");

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: adminKeys.events.invitees(eventId) });
  };

  const ensureMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ inviteToken: string }>(
        `/admin/events/${eventId}/invitees/${invitee.id}/ensure-link`,
      );
      return res.data.inviteToken;
    },
    onSuccess: async (token) => {
      toast.success("Invite link created");
      invalidate();
      await copyInviteUrl(eventSlug, token);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to create link")),
  });

  const patchMutation = useMutation({
    mutationFn: async (maxRedemptions: number) => {
      const linkId = invitee.hostInviteLink?.id;
      if (!linkId) return;
      await api.patch(`/admin/events/${eventId}/invite-links/${linkId}`, {
        maxRedemptions,
      });
    },
    onSuccess: () => {
      toast.success("Redemption cap updated");
      setEditOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update cap")),
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const trimmed = regenerateMaxInput.trim();
      const body =
        trimmed && !Number.isNaN(Number(trimmed))
          ? { maxRedemptions: Number(trimmed) }
          : {};
      const res = await api.post<{ inviteToken: string }>(
        `/admin/events/${eventId}/invitees/${invitee.id}/regenerate-link`,
        body,
      );
      return res.data.inviteToken;
    },
    onSuccess: async (token) => {
      toast.success("Invite link regenerated");
      setRegenerateOpen(false);
      invalidate();
      await copyInviteUrl(eventSlug, token);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to regenerate link")),
  });

  if (revoked) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  if (invitee.profilePending) {
    return (
      <span className="text-xs text-muted-foreground" title="Person profile must be linked first">
        Profile pending
      </span>
    );
  }

  const link = invitee.hostInviteLink;

  if (!link) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={ensureMutation.isPending}
        onClick={() => ensureMutation.mutate()}
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
        <span className="text-foreground">{link.remainingRedemptions}</span> left ·{" "}
        {link.usedRedemptions}/{link.maxRedemptions} used
      </p>
      <div className="flex flex-wrap gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void copyInviteUrl(eventSlug, link.token)}
        >
          Copy link
        </Button>
        <Button variant="outline" size="sm" onClick={openEdit}>
          Edit cap
        </Button>
        <Button variant="ghost" size="sm" onClick={openRegenerate}>
          Regenerate
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit redemption cap</DialogTitle>
          </DialogHeader>
          <FormField label="Max guest redemptions">
            <Input
              type="number"
              min={link.usedRedemptions}
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
                patchMutation.mutate(n);
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
            The current URL will stop working. A new link will be copied to your clipboard.
          </p>
          <FormField label="Max guest redemptions (optional)">
            <Input
              type="number"
              min={0}
              placeholder={String(defaultMaxRedemptions)}
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
              variant="destructive"
              disabled={regenerateMutation.isPending}
              onClick={() => regenerateMutation.mutate()}
            >
              {regenerateMutation.isPending ? "Regenerating…" : "Regenerate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

