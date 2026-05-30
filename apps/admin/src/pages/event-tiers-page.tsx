import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TierEditor } from "@/components/tier-editor";
import { useEventIdParam } from "@/hooks/use-event-id-param";
import { useEventWorkspaceQueries } from "@/hooks/use-event-workspace-queries";

export function EventTiersPage() {
  const { eventId } = useEventIdParam();
  const { tiers, isLoading } = useEventWorkspaceQueries(eventId);

  if (isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  return (
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
  );
}
