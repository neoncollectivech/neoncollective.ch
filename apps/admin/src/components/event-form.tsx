import type { EventFormValues } from "@/lib/admin-types";

import { useState } from "react";

import { LocalizedFieldsEditor } from "@/components/localized-fields-editor";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type EventFormProps = {
  mode: "create" | "update";
  initialValues: EventFormValues;
  onSubmit: (values: EventFormValues) => void | Promise<void>;
  onCancel?: () => void;
  isPending?: boolean;
};

export function EventForm({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  isPending,
}: EventFormProps) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof EventFormValues>(
    key: K,
    value: EventFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.slug.trim() || !values.title.trim()) {
      setError("Slug and title are required.");

      return;
    }
    setError(null);
    void onSubmit(values);
  };

  return (
    <form className="space-y-4 max-w-xl" onSubmit={handleSubmit}>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <FormField htmlFor="slug" label="Slug">
        <Input
          id="slug"
          placeholder="my-event"
          value={values.slug}
          onChange={(e) => set("slug", e.target.value)}
        />
      </FormField>

      <FormField htmlFor="title" label="Title">
        <Input
          id="title"
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </FormField>

      <FormField htmlFor="summary" label="Summary">
        <LocalizedFieldsEditor
          id="summary"
          value={values.summary}
          variant="markdown"
          onChange={(v) => set("summary", v)}
        />
      </FormField>

      <FormField htmlFor="location" label="Location">
        <Input
          id="location"
          value={values.location}
          onChange={(e) => set("location", e.target.value)}
        />
      </FormField>

      <FormField htmlFor="startsAt" label="Starts at">
        <Input
          id="startsAt"
          type="datetime-local"
          value={values.startsAt}
          onChange={(e) => set("startsAt", e.target.value)}
        />
      </FormField>

      <FormField htmlFor="accessMode" label="Access mode">
        <Select
          id="accessMode"
          value={values.accessMode}
          onChange={(e) =>
            set("accessMode", e.target.value as EventFormValues["accessMode"])
          }
        >
          <option value="public">Public</option>
          <option value="invite_only">Invite only</option>
        </Select>
      </FormField>

      {mode === "update" && (
        <FormField htmlFor="status" label="Status">
          <Select
            id="status"
            value={values.status ?? "draft"}
            onChange={(e) =>
              set("status", e.target.value as EventFormValues["status"])
            }
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </Select>
        </FormField>
      )}

      <FormField htmlFor="eventQuota" label="Event quota">
        <Input
          id="eventQuota"
          min={0}
          placeholder="Empty = unlimited"
          type="number"
          value={values.eventQuota}
          onChange={(e) => set("eventQuota", e.target.value)}
        />
      </FormField>

      {values.accessMode === "invite_only" ? (
        <FormField
          htmlFor="defaultInviteLinkMaxRedemptions"
          label="Default invite max redemptions"
        >
          <Input
            id="defaultInviteLinkMaxRedemptions"
            min={0}
            type="number"
            value={values.defaultInviteLinkMaxRedemptions}
            onChange={(e) =>
              set("defaultInviteLinkMaxRedemptions", e.target.value)
            }
          />
        </FormField>
      ) : null}

      <div className="flex gap-2">
        <Button disabled={isPending} type="submit">
          {isPending
            ? "Saving…"
            : mode === "create"
              ? "Create event"
              : "Save changes"}
        </Button>
        {onCancel && (
          <Button
            disabled={isPending}
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
