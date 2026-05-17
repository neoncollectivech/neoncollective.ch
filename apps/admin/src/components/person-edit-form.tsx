import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PersonEditForm } from "@/lib/person-form-utils";

type PersonEditFormProps = {
  form: PersonEditForm;
  isPending?: boolean;
  onChange: (form: PersonEditForm) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function PersonEditFormFields({
  form,
  isPending,
  onChange,
  onCancel,
  onSubmit,
}: PersonEditFormProps) {
  const set = <K extends keyof PersonEditForm>(key: K, value: PersonEditForm[K]) => {
    onChange({ ...form, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Given name">
          <Input
            value={form.givenName}
            onChange={(e) => set("givenName", e.target.value)}
          />
        </FormField>
        <FormField label="Family name">
          <Input
            value={form.familyName}
            onChange={(e) => set("familyName", e.target.value)}
          />
        </FormField>
      </div>
      <FormField label="Email">
        <Input
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </FormField>
      <FormField label="Phone">
        <Input
          value={form.phoneE164}
          placeholder="+41791234567"
          onChange={(e) => set("phoneE164", e.target.value)}
        />
      </FormField>
      <p className="text-xs text-muted-foreground">
        Email or phone required. Changing contact clears verification until you verify again.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={
            isPending ||
            !form.givenName.trim() ||
            !form.familyName.trim() ||
            (!form.email.trim() && !form.phoneE164.trim())
          }
          onClick={onSubmit}
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
