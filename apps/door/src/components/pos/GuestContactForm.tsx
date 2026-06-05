import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type GuestContactValues = {
  givenName: string;
  familyName: string;
  email: string;
  phoneE164: string;
};

type GuestContactFormProps = {
  initial?: Partial<GuestContactValues>;
  onSubmit: (values: GuestContactValues) => void;
  disabled?: boolean;
};

export function GuestContactForm({
  initial,
  onSubmit,
  disabled,
}: GuestContactFormProps) {
  const [givenName, setGivenName] = useState(initial?.givenName ?? "");
  const [familyName, setFamilyName] = useState(initial?.familyName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phoneE164, setPhoneE164] = useState(initial?.phoneE164 ?? "");

  const canSubmit =
    givenName.trim().length > 0 &&
    familyName.trim().length > 0 &&
    (email.trim().length > 0 || phoneE164.trim().length > 0);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit || disabled) {
          return;
        }
        onSubmit({
          givenName: givenName.trim(),
          familyName: familyName.trim(),
          email: email.trim(),
          phoneE164: phoneE164.trim(),
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="pos-given-name">First name</Label>
          <Input
            autoComplete="given-name"
            disabled={disabled}
            id="pos-given-name"
            value={givenName}
            onChange={(e) => setGivenName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pos-family-name">Last name</Label>
          <Input
            autoComplete="family-name"
            disabled={disabled}
            id="pos-family-name"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pos-email">Email</Label>
        <Input
          autoComplete="email"
          disabled={disabled}
          id="pos-email"
          inputMode="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pos-phone">Phone (E.164)</Label>
        <Input
          autoComplete="tel"
          disabled={disabled}
          id="pos-phone"
          inputMode="tel"
          placeholder="+41…"
          type="tel"
          value={phoneE164}
          onChange={(e) => setPhoneE164(e.target.value)}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Email or phone is required.
      </p>
      <Button
        className="w-full"
        disabled={!canSubmit || disabled}
        type="submit"
      >
        Continue
      </Button>
    </form>
  );
}
