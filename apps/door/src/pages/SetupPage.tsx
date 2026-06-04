import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchAdmissionJwks } from "@/lib/admission-jwks";
import { getApiErrorMessage } from "@/lib/api-error";
import { isJwksEventRequiredError } from "@/lib/jwks-errors";
import {
  isApiKeyTokenFormat,
  setDoorApiKeyConfig,
  setDoorSessionConfig,
} from "@/lib/storage/session-config";

export function SetupPage() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [keyLabel, setKeyLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = apiKey.trim();

    if (!isApiKeyTokenFormat(trimmed)) {
      toast.error(
        "Invalid API key. Keys start with neon_ and are shown once in admin.",
      );

      return;
    }

    setSubmitting(true);

    try {
      const jwks = await fetchAdmissionJwks({
        apiKey: trimmed,
        eventId: null,
      });

      setDoorSessionConfig({
        apiKey: trimmed,
        keyLabel: keyLabel.trim() || null,
        eventId: jwks.eventId,
      });
      navigate("/", { replace: true });
    } catch (error) {
      if (isJwksEventRequiredError(error)) {
        setDoorApiKeyConfig({
          apiKey: trimmed,
          keyLabel: keyLabel.trim() || null,
        });
        navigate("/setup/event", { replace: true });

        return;
      }

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        toast.error("Invalid API key.");

        return;
      }

      toast.error(
        getApiErrorMessage(
          error,
          "Could not validate API key or load signing keys.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="door-scroll-page door-scroll-page--centered max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>NEON Door setup</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
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
                once at creation. You will choose the event next.
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
            <Button className="w-full" disabled={submitting} type="submit">
              {submitting ? "Validating…" : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
