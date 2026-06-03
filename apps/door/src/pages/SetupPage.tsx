import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isApiKeyTokenFormat,
  setDoorSessionConfig,
} from "@/lib/storage/session-config";

export function SetupPage() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [keyLabel, setKeyLabel] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = apiKey.trim();

    if (!isApiKeyTokenFormat(trimmed)) {
      toast.error(
        "Invalid API key. Keys start with neon_ and are shown once in admin.",
      );

      return;
    }

    setDoorSessionConfig({
      apiKey: trimmed,
      keyLabel: keyLabel.trim() || null,
    });
    navigate("/", { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>NEON Door setup</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="apiKey">Event API key</Label>
              <Input
                required
                autoComplete="off"
                id="apiKey"
                placeholder="neon_…"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Create a key in NEON Admin → API Keys. Paste the token shown
                once at creation.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="keyLabel">Label (optional)</Label>
              <Input
                id="keyLabel"
                placeholder="Main entrance"
                value={keyLabel}
                onChange={(e) => setKeyLabel(e.target.value)}
              />
            </div>
            <Button className="w-full" type="submit">
              Save and open scanner
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
