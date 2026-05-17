import { useState } from "react";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { EventFormValues } from "@/lib/admin-types";

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

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => {
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
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <FormField label="Slug" htmlFor="slug">
        <Input
          id="slug"
          value={values.slug}
          onChange={(e) => set("slug", e.target.value)}
          placeholder="my-event"
        />
        <p className="text-xs text-muted-foreground">Lowercase; normalized on save.</p>
      </FormField>

      <FormField label="Title" htmlFor="title">
        <Input
          id="title"
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </FormField>

      <FormField label="Summary" htmlFor="summary">
        <Textarea
          id="summary"
          value={values.summary}
          onChange={(e) => set("summary", e.target.value)}
          rows={3}
        />
      </FormField>

      <FormField label="Location" htmlFor="location">
        <Input
          id="location"
          value={values.location}
          onChange={(e) => set("location", e.target.value)}
        />
      </FormField>

      <FormField label="Starts at" htmlFor="startsAt">
        <Input
          id="startsAt"
          type="datetime-local"
          value={values.startsAt}
          onChange={(e) => set("startsAt", e.target.value)}
        />
      </FormField>

      <FormField label="Access mode" htmlFor="accessMode">
        <Select
          id="accessMode"
          value={values.accessMode}
          onChange={(e) => set("accessMode", e.target.value as EventFormValues["accessMode"])}
        >
          <option value="public">Public</option>
          <option value="invite_only">Invite only</option>
        </Select>
      </FormField>

      {mode === "update" && (
        <FormField label="Status" htmlFor="status">
          <Select
            id="status"
            value={values.status ?? "draft"}
            onChange={(e) => set("status", e.target.value as EventFormValues["status"])}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </Select>
        </FormField>
      )}

      <FormField label="Event quota" htmlFor="eventQuota">
        <Input
          id="eventQuota"
          type="number"
          min={0}
          value={values.eventQuota}
          onChange={(e) => set("eventQuota", e.target.value)}
          placeholder="Empty = unlimited"
        />
      </FormField>

      {values.accessMode === "invite_only" ? (
        <FormField
          label="Default invite max redemptions"
          htmlFor="defaultInviteLinkMaxRedemptions"
        >
          <Input
            id="defaultInviteLinkMaxRedemptions"
            type="number"
            min={0}
            value={values.defaultInviteLinkMaxRedemptions}
            onChange={(e) => set("defaultInviteLinkMaxRedemptions", e.target.value)}
          />
        </FormField>
      ) : null}

      <FormField label="Image URLs" htmlFor="imageUrls">
        <Textarea
          id="imageUrls"
          value={values.imageUrlsText}
          onChange={(e) => set("imageUrlsText", e.target.value)}
          rows={4}
          placeholder="One URL per line"
          className="font-mono text-xs"
        />
      </FormField>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create event" : "Save changes"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
