import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventPromotionCodes } from "@/components/event-promotion-codes";
import { useEventIdParam } from "@/hooks/use-event-id-param";
import { useEventWorkspaceQueries } from "@/hooks/use-event-workspace-queries";

export function EventPromotionsPage() {
  const { eventId } = useEventIdParam();
  const { event, tiers, isLoading } = useEventWorkspaceQueries(eventId);

  if (isLoading && !event) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!event) {
    return <p className="text-muted-foreground">Event not found.</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Promotions</h2>
      <Card>
        <CardHeader>
          <CardTitle>Promotion codes</CardTitle>
        </CardHeader>
        <CardContent>
          <EventPromotionCodes
            eventId={eventId}
            eventSlug={event.slug}
            inviteOnly={event.accessMode === "invite_only"}
            tiers={tiers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
