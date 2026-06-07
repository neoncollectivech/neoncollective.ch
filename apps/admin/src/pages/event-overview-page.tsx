import {
  defaultLocale,
  localeLabels,
  locales,
  pickLocalizedText,
  type Locale,
} from "@neon/site-locales";
import { useState } from "react";
import { Link } from "react-router-dom";

import { MarkdownContent } from "@/components/markdown-field";
import { EventCapacityStats } from "@/components/event-capacity-stats";
import { EventSalesAnalytics } from "@/components/event-sales-analytics/event-sales-analytics";
import { EventWorkspaceGate } from "@/components/layout/event-workspace-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEventIdParam } from "@/hooks/use-event-id-param";
import { eventSettingsPath } from "@/lib/event-workspace-paths";

export function EventOverviewPage() {
  const { eventId } = useEventIdParam();
  const [previewLocale, setPreviewLocale] = useState<Locale>(defaultLocale);

  return (
    <EventWorkspaceGate eventId={eventId}>
      {({ event, tiers, capacity }) => {
        const summaryPreview = pickLocalizedText(event.summary, previewLocale);

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Overview</h2>
              <Button asChild size="sm" variant="outline">
                <Link to={eventSettingsPath(eventId)}>Edit settings</Link>
              </Button>
            </div>

            <EventSalesAnalytics eventId={eventId} />

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <CardTitle>{event.title}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={
                      event.status === "published" ? "default" : "secondary"
                    }
                  >
                    {event.status}
                  </Badge>
                  <Badge variant="outline">{event.accessMode}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Slug:</span>{" "}
                  {event.slug}
                </p>
                <p>
                  <span className="text-muted-foreground">Access:</span>{" "}
                  {event.accessMode}
                </p>
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
                {summaryPreview ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {locales.map((locale) => (
                        <Button
                          key={locale}
                          size="sm"
                          type="button"
                          variant={
                            previewLocale === locale ? "default" : "outline"
                          }
                          onClick={() => setPreviewLocale(locale)}
                        >
                          {localeLabels[locale]}
                        </Button>
                      ))}
                    </div>
                    <MarkdownContent
                      className="text-foreground/90"
                      source={summaryPreview}
                    />
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <EventCapacityStats
                  capacity={capacity}
                  eventQuota={event.eventQuota}
                  tiers={tiers}
                />
              </CardContent>
            </Card>
          </div>
        );
      }}
    </EventWorkspaceGate>
  );
}
