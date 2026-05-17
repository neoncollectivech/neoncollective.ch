import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";
import type { TierFormRow, TierRow } from "@/lib/admin-types";
import { adminKeys } from "@/lib/query-keys";

type TierEditorProps = {
  eventId: string;
  tiers: TierRow[];
};

function tierToFormRow(tier: TierRow): TierFormRow {
  return {
    name: tier.name,
    description: tier.description ?? "",
    priceChf: (tier.priceCents / 100).toFixed(2),
    quota: tier.quota != null ? String(tier.quota) : "",
    active: tier.active,
  };
}

function emptyTierRow(): TierFormRow {
  return {
    name: "",
    description: "",
    priceChf: "",
    quota: "",
    active: true,
  };
}

export function TierEditor({ eventId, tiers }: TierEditorProps) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<TierFormRow[]>(() => tiers.map(tierToFormRow));

  useEffect(() => {
    setRows(tiers.map(tierToFormRow));
  }, [tiers]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { tiers: Omit<TierRow, "id">[] }) => {
      await api.put(`/admin/events/${eventId}/tiers`, payload);
    },
    onSuccess: () => {
      toast.success("Tiers saved");
      void qc.invalidateQueries({ queryKey: adminKeys.events.detail(eventId) });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to save tiers")),
  });

  const updateRow = (index: number, patch: Partial<TierFormRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!confirm("This replaces all tiers for this event. Continue?")) {
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
        id: null,
        name: row.name.trim(),
        description: row.description.trim(),
        priceCents: Math.round(Number(row.priceChf) * 100),
        currency: "chf",
        quota: row.quota.trim() ? Number(row.quota) : null,
        sortOrder: index,
        active: row.active,
      })),
    };

    saveMutation.mutate(payload);
  };

  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <div key={index} className="border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Tier {index + 1}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(index)}>
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
              value={row.description}
              onChange={(e) => updateRow(index, { description: e.target.value })}
              rows={2}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Price (CHF)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={row.priceChf}
                onChange={(e) => updateRow(index, { priceChf: e.target.value })}
              />
            </FormField>
            <FormField label="Quota">
              <Input
                type="number"
                min={0}
                value={row.quota}
                onChange={(e) => updateRow(index, { quota: e.target.value })}
                placeholder="Unlimited"
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={row.active}
              onChange={(e) => updateRow(index, { active: e.target.checked })}
            />
            Active
          </label>
        </div>
      ))}

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => setRows((prev) => [...prev, emptyTierRow()])}>
          Add tier
        </Button>
        <Button type="button" onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : "Save tiers"}
        </Button>
      </div>
    </div>
  );
}
