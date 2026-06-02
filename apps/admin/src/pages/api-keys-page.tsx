import type { ApiKeyCreateResult } from "@/lib/admin-api";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ApiKeyFormDialog } from "@/components/api-key-form-dialog";
import { ApiKeyTokenDialog } from "@/components/api-key-token-dialog";
import { ApiKeysTable } from "@/components/api-keys-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { adminApi } from "@/hooks/use-admin-api";
import { getApiErrorMessage } from "@/lib/api-error";
import { eventsListService } from "@/lib/admin-list-services";

export function ApiKeysPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [tokenDialog, setTokenDialog] = useState<{
    token: string;
    label: string;
  } | null>(null);

  const keysQuery = useQuery(adminApi.apiKeys.list());
  const eventsQuery = useQuery(
    eventsListService.listQuery({
      page: 1,
      pageSize: 200,
      sort: "title:asc",
    }),
  );

  function handleCreated(result: ApiKeyCreateResult) {
    setTokenDialog({ token: result.token, label: result.item.label });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">API keys</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Bearer tokens for check-in, admissions export, and invite-only
            catalog access. Prefer scoped keys over global when possible.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Create API key</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All keys</CardTitle>
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
            <ApiKeysTable rows={keysQuery.data ?? []} />
          )}
        </CardContent>
      </Card>

      <ApiKeyFormDialog
        events={eventsQuery.data?.items ?? []}
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
