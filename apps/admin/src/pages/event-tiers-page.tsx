import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TierEditor } from "@/components/tier-editor";
import { EventWorkspaceGate } from "@/components/layout/event-workspace-gate";
import { useEventIdParam } from "@/hooks/use-event-id-param";

export function EventTiersPage() {
  const { eventId } = useEventIdParam();

  return (
    <EventWorkspaceGate eventId={eventId}>
      {({ tiers }) => (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">Tiers</h2>
          <Card>
            <CardHeader>
              <CardTitle>Tiers</CardTitle>
            </CardHeader>
            <CardContent>
              <TierEditor eventId={eventId} tiers={tiers} />
            </CardContent>
          </Card>
        </div>
      )}
    </EventWorkspaceGate>
  );
}
