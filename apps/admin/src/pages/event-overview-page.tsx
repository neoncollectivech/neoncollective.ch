import { Link } from "react-router-dom";

import { EventCapacityStats } from "@/components/event-capacity-stats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEventIdParam } from "@/hooks/use-event-id-param";
import { useEventWorkspaceQueries } from "@/hooks/use-event-workspace-queries";
import { eventSettingsPath } from "@/lib/event-workspace-paths";

export function EventOverviewPage() {
  const { eventId } = useEventIdParam();
  const { event, tiers, capacity, isLoading } =
    useEventWorkspaceQueries(eventId);

  if (isLoading && !event) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!event) {
    return <p className="text-muted-foreground">Event not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Overview</h2>
        <Button asChild size="sm" variant="outline">
          <Link to={eventSettingsPath(eventId)}>Edit settings</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{event.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Slug:</span> {event.slug}
          </p>
          <p>
            <span className="text-muted-foreground">Access:</span>{" "}
            {event.accessMode}
          </p>
          {event.accessMode === "public" ? (
            <p className="text-muted-foreground">
              Event invites are not used for public events.
            </p>
          ) : null}
          {event.location ? (
            <p>
              <span className="text-muted-foreground">Location:</span>{" "}
              {event.location}
            </p>
          ) : null}
          {event.startsAt ? (
            <p>
              <span className="text-muted-foreground">Starts:</span>{" "}
              {new Date(event.startsAt).toLocaleString()}
            </p>
          ) : null}
          {event.summary ? <p>{event.summary}</p> : null}
          <EventCapacityStats
            capacity={capacity}
            eventQuota={event.eventQuota}
            tiers={tiers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
