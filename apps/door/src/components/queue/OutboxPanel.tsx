import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listOutboxRows,
  type CheckInOutboxRow,
} from "@/lib/storage/check-in-outbox";
import { processOutbox } from "@/lib/storage/sync-outbox";
import { doorApi } from "@/hooks/use-door-api";
import { queryClient } from "@/lib/query-client";
import { doorKeys } from "@/hooks/use-door-api/keys";

function statusVariant(
  status: CheckInOutboxRow["status"],
): "default" | "secondary" | "outline" {
  if (status === "synced") {
    return "default";
  }

  if (status === "failed") {
    return "outline";
  }

  return "secondary";
}

export function OutboxPanel() {
  const [rows, setRows] = useState<CheckInOutboxRow[]>([]);
  const { data: pending = 0 } = useQuery(doorApi.outbox.stats());

  const reload = async () => {
    setRows(await listOutboxRows());
    void queryClient.invalidateQueries({ queryKey: doorKeys.outbox.stats() });
  };

  useEffect(() => {
    void reload();
  }, [pending]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Check-in queue</CardTitle>
        <Badge variant="secondary">{pending} pending</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No queued check-ins.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-border p-3 text-sm"
              >
                <span className="font-mono text-xs">{row.token}</span>
                <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                {row.lastError ? (
                  <span className="w-full text-xs text-muted-foreground">
                    {row.lastError}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => void processOutbox().then(() => reload())}
        >
          Sync now
        </Button>
      </CardContent>
    </Card>
  );
}
