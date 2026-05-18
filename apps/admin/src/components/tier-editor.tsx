import type { TierFormRow, TierRow } from "@/lib/admin-types";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminApi } from "@/hooks/use-admin-api";

type TierEditorProps = {
  eventId: string;
  tiers: TierRow[];
};

function tierToFormRow(tier: TierRow): TierFormRow {
  return {
    id: tier.id,
    name: tier.name,
    description: tier.description ?? "",
    priceChf: (tier.priceCents / 100).toFixed(2),
    quota: tier.quota != null ? String(tier.quota) : "",
    active: tier.active,
    selectionMode: tier.selectionMode ?? "exclusive",
  };
}

function emptyTierRow(): TierFormRow {
  return {
    id: null,
    name: "",
    description: "",
    priceChf: "",
    quota: "",
    active: true,
    selectionMode: "exclusive",
  };
}

export function TierEditor({ eventId, tiers }: TierEditorProps) {
  const [rows, setRows] = useState<TierFormRow[]>(() =>
    tiers.map(tierToFormRow),
  );
  const saveMutation = useMutation(adminApi.event.putTiers(eventId));

  useEffect(() => {
    setRows(tiers.map(tierToFormRow));
  }, [tiers]);

  const updateRow = (index: number, patch: Partial<TierFormRow>) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!confirm("Save tier changes for this event?")) {
      return;
    }

    for (const row of rows) {
      if (!row.name.trim()) {
        toast.error("Each tier needs a name");

        return;
      }
      const price = Number(row.priceChf);

      if (!Number.isFinite(price) || price <= 0) {
        toast.error(`Invalid price for tier "${row.name}"`);

        return;
      }
    }

    const payload = {
      tiers: rows.map((row, index) => ({
        id: row.id,
        name: row.name.trim(),
        description: row.description.trim(),
        priceCents: Math.round(Number(row.priceChf) * 100),
        currency: "chf",
        quota: row.quota.trim() ? Number(row.quota) : null,
        sortOrder: index,
        active: row.active,
        selectionMode: row.selectionMode,
      })),
    };

    saveMutation.mutate(payload, {
      onSuccess: () => toast.success("Tiers saved"),
    });
  };

  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <div key={index} className="border border-border p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Tier {index + 1}</span>
            {tiers[index]?.sold != null ? (
              <span className="text-xs text-muted-foreground">
                {tiers[index]!.sold} sold ·{" "}
                {tiers[index]!.placesRemaining == null
                  ? "∞"
                  : tiers[index]!.placesRemaining}{" "}
                remaining
              </span>
            ) : null}
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => removeRow(index)}
            >
              Remove
            </Button>
          </div>

          <FormField label="Name">
            <Input
              value={row.name}
              onChange={(e) => updateRow(index, { name: e.target.value })}
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              rows={2}
              value={row.description}
              onChange={(e) =>
                updateRow(index, { description: e.target.value })
              }
            />
          </FormField>

          <FormField label="Selection mode">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={row.selectionMode}
              onChange={(e) =>
                updateRow(index, {
                  selectionMode: e.target.value as TierFormRow["selectionMode"],
                })
              }
            >
              <option value="exclusive">Exclusive (pick one)</option>
              <option value="addon">Add-on (combinable)</option>
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Price (CHF)">
              <Input
                min={0}
                step="0.01"
                type="number"
                value={row.priceChf}
                onChange={(e) => updateRow(index, { priceChf: e.target.value })}
              />
            </FormField>
            <FormField
              label={
                row.selectionMode === "addon" ? "Redemption limit" : "Quota"
              }
            >
              <Input
                min={0}
                placeholder="Unlimited"
                type="number"
                value={row.quota}
                onChange={(e) => updateRow(index, { quota: e.target.value })}
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              checked={row.active}
              type="checkbox"
              onChange={(e) => updateRow(index, { active: e.target.checked })}
            />
            Active
          </label>
        </div>
      ))}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setRows((prev) => [...prev, emptyTierRow()])}
        >
          Add tier
        </Button>
        <Button
          disabled={saveMutation.isPending}
          type="button"
          onClick={handleSave}
        >
          {saveMutation.isPending ? "Saving…" : "Save tiers"}
        </Button>
      </div>
    </div>
  );
}
