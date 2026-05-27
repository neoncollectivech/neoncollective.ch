import type {
  EventPromotionCodeRow,
  PromotionCodeCreatePayload,
} from "@/lib/admin-api";
import type { TierRow } from "@/lib/admin-types";

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
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi } from "@/hooks/use-admin-api";
import { buildPublicPromoUrl } from "@/lib/invite-url";

type EventPromotionCodesProps = {
  eventId: string;
  eventSlug: string;
  inviteOnly: boolean;
  tiers: TierRow[];
};

function formatKind(row: EventPromotionCodeRow): string {
  if (row.kind === "percent_off") {
    return `${((row.percentBps ?? 0) / 100).toFixed(0)}% off`;
  }
  if (row.kind === "amount_off") {
    return `CHF ${((row.amountOffCents ?? 0) / 100).toFixed(2)} off`;
  }

  return "Tier prices";
}

function formatRedemptions(row: EventPromotionCodeRow): string {
  if (row.maxRedemptions == null) {
    return `${row.usedRedemptions} / ∞`;
  }

  return `${row.usedRedemptions} / ${row.maxRedemptions}`;
}

export function EventPromotionCodes({
  eventId,
  eventSlug,
  inviteOnly,
  tiers,
}: EventPromotionCodesProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState("");
  const [kind, setKind] =
    useState<PromotionCodeCreatePayload["kind"]>("percent_off");
  const [percentOff, setPercentOff] = useState("100");
  const [amountOffChf, setAmountOffChf] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [tierPrices, setTierPrices] = useState<Record<string, string>>({});

  const codesQuery = useQuery(adminApi.event.promotionCodes(eventId));
  const createMutation = useMutation(
    adminApi.event.createPromotionCode(eventId),
  );
  const patchMutation = useMutation(adminApi.event.patchPromotionCode(eventId));
  const deleteMutation = useMutation(adminApi.event.deletePromotionCode(eventId));

  async function copyPromoLink(promoCode: string) {
    const url = buildPublicPromoUrl(eventSlug, inviteOnly, promoCode);

    await navigator.clipboard.writeText(url);
    toast.success("Promotion link copied");
  }

  function resetForm() {
    setCode("");
    setKind("percent_off");
    setPercentOff("100");
    setAmountOffChf("");
    setMaxRedemptions("");
    setTierPrices({});
  }

  function buildCreatePayload(): PromotionCodeCreatePayload | null {
    const normalized = code.trim().toUpperCase();

    if (!normalized) {
      toast.error("Code is required");

      return null;
    }
    const payload: PromotionCodeCreatePayload = {
      code: normalized,
      kind,
      active: true,
    };
    const max = maxRedemptions.trim();

    if (max) {
      const n = Number.parseInt(max, 10);

      if (!Number.isFinite(n) || n < 0) {
        toast.error("Invalid max redemptions");

        return null;
      }
      payload.maxRedemptions = n;
    }
    if (kind === "percent_off") {
      const pct = Number.parseFloat(percentOff);

      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        toast.error("Percent must be between 0 and 100");

        return null;
      }
      payload.percentBps = Math.round(pct * 100);
    } else if (kind === "amount_off") {
      const chf = Number.parseFloat(amountOffChf);

      if (!Number.isFinite(chf) || chf < 0) {
        toast.error("Amount off must be a positive number");

        return null;
      }
      payload.amountOffCents = Math.round(chf * 100);
    } else {
      const overrides = tiers
        .filter((tier): tier is TierRow & { id: string } => Boolean(tier.id))
        .map((tier) => {
          const raw = tierPrices[tier.id]?.trim();

          if (!raw) {
            return null;
          }
          const chf = Number.parseFloat(raw);

          if (!Number.isFinite(chf) || chf < 0) {
            return null;
          }

          return { eventTierId: tier.id, priceCents: Math.round(chf * 100) };
        })
        .filter((row) => row != null);

      if (overrides.length === 0) {
        toast.error("Set at least one tier price");

        return null;
      }
      payload.tierOverrides = overrides;
    }

    return payload;
  }

  const rows = codesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          Add promotion code
        </Button>
      </div>

      {codesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No promotion codes yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Effect</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono">{row.code}</TableCell>
                <TableCell>{formatKind(row)}</TableCell>
                <TableCell>{formatRedemptions(row)}</TableCell>
                <TableCell>{row.active ? "Active" : "Inactive"}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void copyPromoLink(row.code)}
                  >
                    Copy link
                  </Button>
                  <Button
                    disabled={patchMutation.isPending}
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      patchMutation.mutate(
                        {
                          promotionCodeId: row.id,
                          payload: { active: !row.active },
                        },
                        {
                          onSuccess: () =>
                            toast.success(
                              row.active
                                ? "Promotion deactivated"
                                : "Promotion activated",
                            ),
                        },
                      );
                    }}
                  >
                    {row.active ? "Deactivate" : "Activate"}
                  </Button>
                  {row.usedRedemptions === 0 ? (
                    <Button
                      disabled={deleteMutation.isPending}
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (
                          confirm(
                            `Delete promotion code "${row.code}"? This cannot be undone.`,
                          )
                        ) {
                          deleteMutation.mutate(row.id, {
                            onSuccess: () =>
                              toast.success("Promotion code deleted"),
                          });
                        }
                      }}
                    >
                      Delete
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New promotion code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Code">
              <Input
                placeholder="PARTNER"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </FormField>
            <FormField label="Type">
              <Select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as PromotionCodeCreatePayload["kind"])
                }
              >
                <option value="percent_off">Percent off cart</option>
                <option value="amount_off">Fixed amount off cart</option>
                <option value="tier_prices">Per-tier prices</option>
              </Select>
            </FormField>
            {kind === "percent_off" ? (
              <FormField label="Percent off (0–100)">
                <Input
                  inputMode="decimal"
                  value={percentOff}
                  onChange={(e) => setPercentOff(e.target.value)}
                />
              </FormField>
            ) : null}
            {kind === "amount_off" ? (
              <FormField label="Amount off (CHF)">
                <Input
                  inputMode="decimal"
                  value={amountOffChf}
                  onChange={(e) => setAmountOffChf(e.target.value)}
                />
              </FormField>
            ) : null}
            {kind === "tier_prices" ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Set checkout price per tier (CHF). Leave blank to skip a tier.
                </p>
                {tiers
                  .filter((tier): tier is TierRow & { id: string } =>
                    Boolean(tier.id),
                  )
                  .map((tier) => (
                    <FormField key={tier.id} label={tier.name}>
                      <Input
                        inputMode="decimal"
                        placeholder={(tier.priceCents / 100).toFixed(2)}
                        value={tierPrices[tier.id] ?? ""}
                        onChange={(e) =>
                          setTierPrices((prev) => ({
                            ...prev,
                            [tier.id]: e.target.value,
                          }))
                        }
                      />
                    </FormField>
                  ))}
              </div>
            ) : null}
            <FormField label="Max redemptions (optional)">
              <Input
                inputMode="numeric"
                placeholder="Unlimited"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={createMutation.isPending}
              onClick={() => {
                const payload = buildCreatePayload();

                if (!payload) {
                  return;
                }
                createMutation.mutate(payload, {
                  onSuccess: () => {
                    toast.success("Promotion code created");
                    setDialogOpen(false);
                    resetForm();
                  },
                });
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
