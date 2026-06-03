import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchAdmissionJwks } from "@/lib/admission-jwks";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  isApiKeyTokenFormat,
  setDoorSessionConfig,
} from "@/lib/storage/session-config";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function SetupPage() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [keyLabel, setKeyLabel] = useState("");
  const [eventId, setEventId] = useState("");
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

    const eventIdTrimmed = eventId.trim();

    if (eventIdTrimmed && !UUID_RE.test(eventIdTrimmed)) {
      toast.error("Event ID must be a valid UUID (for global API keys).");

      return;
    }

    setSubmitting(true);

    try {
      const jwks = await fetchAdmissionJwks({
        apiKey: trimmed,
        eventId: eventIdTrimmed || null,
      });

      setDoorSessionConfig({
        apiKey: trimmed,
        keyLabel: keyLabel.trim() || null,
        eventId: jwks.eventId,
      });
      navigate("/", { replace: true });
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Could not load admission signing keys. Check the API key and event ID.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
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
                once at creation.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventId">Event ID (global keys only)</Label>
              <Input
                autoComplete="off"
                id="eventId"
                placeholder="uuid"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Event-scoped keys resolve the event automatically. Global keys
                require the event UUID here.
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
              {submitting ? "Loading keys…" : "Save and open scanner"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
