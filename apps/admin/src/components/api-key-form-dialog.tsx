import type { ApiKeyCreateResult } from "@/lib/admin-api";
import type { EventRow } from "@/lib/admin-api";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { adminApi } from "@/hooks/use-admin-api";

type ApiKeyScopeMode = "global" | "event";

const SCOPE_OPTIONS = [
  { id: "check_in", label: "Check-in" },
  { id: "pos", label: "POS sales" },
  { id: "pos_admin", label: "SumUp reader setup" },
  { id: "admissions_list", label: "Admissions list" },
] as const;

const DEFAULT_EVENT_SCOPES = ["check_in", "pos"];
const DEFAULT_GLOBAL_SCOPES = SCOPE_OPTIONS.map((option) => option.id);

type ApiKeyFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, key is always scoped to this event (event workspace). */
  fixedEventId?: string;
  events?: EventRow[];
  onCreated: (result: ApiKeyCreateResult) => void;
};

export function ApiKeyFormDialog({
  open,
  onOpenChange,
  fixedEventId,
  events = [],
  onCreated,
}: ApiKeyFormDialogProps) {
  const [label, setLabel] = useState("");
  const [scopeMode, setScopeMode] = useState<ApiKeyScopeMode>("global");
  const [eventId, setEventId] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    ...DEFAULT_GLOBAL_SCOPES,
  ]);

  const createMutation = useMutation(
    fixedEventId
      ? adminApi.apiKeys.createForEvent(fixedEventId)
      : adminApi.apiKeys.create(),
  );

  function resetForm() {
    setLabel("");
    setScopeMode("global");
    setEventId("");
    setSelectedScopes([...DEFAULT_GLOBAL_SCOPES]);
  }

  function toggleScope(scopeId: string, checked: boolean) {
    setSelectedScopes((current) => {
      if (checked) {
        return current.includes(scopeId) ? current : [...current, scopeId];
      }

      return current.filter((scope) => scope !== scopeId);
    });
  }

  async function handleSubmit() {
    const trimmed = label.trim();

    if (!trimmed) {
      toast.error("Label is required");

      return;
    }

    if (fixedEventId) {
      const result = await createMutation.mutateAsync({ label: trimmed });

      resetForm();
      onOpenChange(false);
      onCreated(result);

      return;
    }

    const scopedEventId =
      scopeMode === "global" ? null : eventId.trim() || null;

    if (scopeMode === "event" && !scopedEventId) {
      toast.error("Select an event for a scoped key");

      return;
    }

    const scopes =
      scopeMode === "global" ? selectedScopes : DEFAULT_EVENT_SCOPES;

    if (scopes.length === 0) {
      toast.error("Select at least one capability");

      return;
    }

    const result = await createMutation.mutateAsync({
      label: trimmed,
      eventId: scopedEventId,
      scopes,
    });

    resetForm();
    onOpenChange(false);
    onCreated(result);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetForm();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <FormField htmlFor="api-key-label" label="Label">
            <Input
              id="api-key-label"
              placeholder="Door scanner, CRM sync, …"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </FormField>

          {!fixedEventId ? (
            <>
              <FormField htmlFor="api-key-scope" label="Scope">
                <Select
                  id="api-key-scope"
                  value={scopeMode}
                  onChange={(e) => {
                    const mode = e.target.value as ApiKeyScopeMode;

                    setScopeMode(mode);
                    setSelectedScopes(
                      mode === "global"
                        ? [...DEFAULT_GLOBAL_SCOPES]
                        : [...DEFAULT_EVENT_SCOPES],
                    );
                  }}
                >
                  <option value="global">All events</option>
                  <option value="event">Single event</option>
                </Select>
              </FormField>

              {scopeMode === "event" ? (
                <FormField htmlFor="api-key-event" label="Event">
                  <Select
                    id="api-key-event"
                    value={eventId}
                    onChange={(e) => setEventId(e.target.value)}
                  >
                    <option value="">Select event…</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Capabilities</legend>
                  {SCOPE_OPTIONS.map((option) => (
                    <div key={option.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedScopes.includes(option.id)}
                        id={`api-key-scope-${option.id}`}
                        onCheckedChange={(checked) =>
                          toggleScope(option.id, checked === true)
                        }
                      />
                      <Label htmlFor={`api-key-scope-${option.id}`}>
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </fieldset>
              )}
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={createMutation.isPending}
            onClick={() => void handleSubmit()}
          >
            {createMutation.isPending ? <InlineSpinner /> : null}
            Create key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
