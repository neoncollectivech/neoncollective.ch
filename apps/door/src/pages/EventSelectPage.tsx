import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAdmissionJwks } from "@/lib/admission-jwks";
import { listDoorEvents } from "@/lib/door-api";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  clearDoorSessionConfig,
  getDoorApiKeyConfig,
  getDoorSessionConfig,
  setDoorSessionConfig,
} from "@/lib/storage/session-config";

function formatEventWhen(startsAt: string | null): string {
  if (!startsAt) {
    return "Date TBD";
  }

  return new Date(startsAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function EventSelectPage() {
  const navigate = useNavigate();
  const keyConfig = getDoorApiKeyConfig();
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const eventsQuery = useQuery({
    queryKey: ["door", "events", keyConfig?.apiKey ?? ""],
    queryFn: () => listDoorEvents(keyConfig!.apiKey),
    enabled: Boolean(keyConfig?.apiKey),
  });

  if (!keyConfig) {
    return <Navigate replace to="/setup" />;
  }

  const handleSelect = async (event: { id: string; title: string }) => {
    setSelectingId(event.id);

    try {
      await fetchAdmissionJwks({
        apiKey: keyConfig.apiKey,
        eventId: event.id,
      });

      setDoorSessionConfig({
        apiKey: keyConfig.apiKey,
        keyLabel: keyConfig.keyLabel,
        eventId: event.id,
        eventTitle: event.title,
      });
      navigate("/", { replace: true });
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Could not load signing keys for this event.",
        ),
      );
    } finally {
      setSelectingId(null);
    }
  };

  const existingSession = getDoorSessionConfig();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Choose event</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Global API keys must select which event you are checking in for.
          </p>

          {eventsQuery.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading events…
            </p>
          ) : eventsQuery.isError ? (
            <p className="text-sm text-destructive">
              {getApiErrorMessage(eventsQuery.error, "Could not load events.")}
            </p>
          ) : eventsQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No published events available for this API key.
            </p>
          ) : (
            <ul className="space-y-2">
              {eventsQuery.data?.map((ev) => (
                <li key={ev.id}>
                  <Button
                    className="h-auto w-full flex-col items-start gap-1 py-3 text-left"
                    disabled={selectingId !== null}
                    variant="outline"
                    onClick={() => void handleSelect(ev)}
                  >
                    <span className="font-medium">{ev.title}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {formatEventWhen(ev.startsAt)}
                      {ev.location ? ` · ${ev.location}` : ""}
                      {ev.inviteOnly ? " · Invite only" : ""}
                    </span>
                    {selectingId === ev.id ? (
                      <span className="text-xs text-muted-foreground">
                        Loading keys…
                      </span>
                    ) : null}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {existingSession ? (
              <Button asChild variant="outline">
                <Link to="/">Back to scanner</Link>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => {
                clearDoorSessionConfig();
                navigate("/setup", { replace: true });
              }}
            >
              Change API key
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
