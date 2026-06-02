import type { ApiKeyCreateResult } from "@/lib/admin-api";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ApiKeyFormDialog } from "@/components/api-key-form-dialog";
import { ApiKeyTokenDialog } from "@/components/api-key-token-dialog";
import { ApiKeysTable } from "@/components/api-keys-table";
import { EventWorkspaceGate } from "@/components/layout/event-workspace-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { adminApi } from "@/hooks/use-admin-api";
import { useEventIdParam } from "@/hooks/use-event-id-param";
import { getApiErrorMessage } from "@/lib/api-error";

type EventApiKeysContentProps = {
  eventId: string;
};

function EventApiKeysContent({ eventId }: EventApiKeysContentProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [tokenDialog, setTokenDialog] = useState<{
    token: string;
    label: string;
  } | null>(null);

  const keysQuery = useQuery(adminApi.apiKeys.forEvent(eventId));

  function handleCreated(result: ApiKeyCreateResult) {
    setTokenDialog({ token: result.token, label: result.item.label });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-2xl font-semibold">API keys</h2>
        <Button onClick={() => setCreateOpen(true)}>Create API key</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Keys for this event</CardTitle>
        </CardHeader>
        <CardContent>
          {keysQuery.isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <InlineSpinner />
              Loading…
            </p>
          ) : keysQuery.isError ? (
            <p className="text-sm text-destructive">
              {getApiErrorMessage(keysQuery.error)}
            </p>
          ) : (
            <ApiKeysTable rows={keysQuery.data ?? []} showEventColumn={false} />
          )}
        </CardContent>
      </Card>

      <ApiKeyFormDialog
        fixedEventId={eventId}
        open={createOpen}
        onCreated={handleCreated}
        onOpenChange={setCreateOpen}
      />

      <ApiKeyTokenDialog
        label={tokenDialog?.label ?? ""}
        open={tokenDialog !== null}
        token={tokenDialog?.token ?? null}
        onOpenChange={(open) => {
          if (!open) {
            setTokenDialog(null);
          }
        }}
      />
    </div>
  );
}

export function EventApiKeysPage() {
  const { eventId } = useEventIdParam();

  return (
    <EventWorkspaceGate eventId={eventId}>
      {() => <EventApiKeysContent eventId={eventId} />}
    </EventWorkspaceGate>
  );
}
