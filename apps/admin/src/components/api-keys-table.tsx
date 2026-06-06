import type { ApiKeyCreateResult, ApiKeyRow } from "@/lib/admin-api";

import { useMutation } from "@tanstack/react-query";

import { AdminFkCell } from "@/components/admin-fk/admin-fk-cell";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi } from "@/hooks/use-admin-api";
import { useForeignKey } from "@/hooks/use-foreign-key";
import { eventFkService } from "@/lib/admin-fk-services";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

type ApiKeysTableProps = {
  rows: ApiKeyRow[];
  /** Hide event column when all keys are for one event. */
  showEventColumn?: boolean;
  onTokenIssued?: (result: ApiKeyCreateResult) => void;
};

export function ApiKeysTable({
  rows,
  showEventColumn = true,
  onTokenIssued,
}: ApiKeysTableProps) {
  const revokeMutation = useMutation(adminApi.apiKeys.revoke());
  const rotateMutation = useMutation(adminApi.apiKeys.rotate());
  const deleteMutation = useMutation(adminApi.apiKeys.delete());
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const fk = useForeignKey({
    rows,
    load: showEventColumn ? [eventFkService] : [],
  });

  const isPending =
    revokeMutation.isPending ||
    rotateMutation.isPending ||
    deleteMutation.isPending;

  function handleRevoke(row: ApiKeyRow) {
    if (row.revokedAt) {
      return;
    }

    confirm({
      title: `Revoke API key "${row.label}" (${row.keyPrefix}…)?`,
      description: "Integrations using it will stop working.",
      confirmLabel: "Revoke",
      variant: "destructive",
      onConfirm: () => revokeMutation.mutate(row.id),
    });
  }

  function handleRotate(row: ApiKeyRow) {
    if (row.revokedAt) {
      return;
    }

    confirm({
      title: `Rotate API key "${row.label}" (${row.keyPrefix}…)?`,
      description: "The current token will be revoked and a new one issued.",
      confirmLabel: "Rotate",
      onConfirm: () =>
        rotateMutation.mutate(row.id, {
          onSuccess: (result) => onTokenIssued?.(result),
        }),
    });
  }

  function handleDelete(row: ApiKeyRow) {
    if (!row.revokedAt) {
      return;
    }

    confirm({
      title: `Permanently delete revoked key "${row.label}" (${row.keyPrefix}…)?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
      onConfirm: () => deleteMutation.mutate(row.id),
    });
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No API keys yet.</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
            <TableHead>Prefix</TableHead>
            {showEventColumn ? <TableHead>Scope</TableHead> : null}
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead className="w-48 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {row.keyPrefix}…
              </TableCell>
              {showEventColumn ? (
                <TableCell>
                  {row.eventId === null ? (
                    <span className="text-muted-foreground">All events</span>
                  ) : (
                    <AdminFkCell
                      fk={fk}
                      fkService={eventFkService}
                      foreignDisplayField="title"
                      foreignId={row.eventId}
                    />
                  )}
                </TableCell>
              ) : null}
              <TableCell>
                {row.revokedAt ? (
                  <Badge variant="secondary">Revoked</Badge>
                ) : (
                  <Badge variant="default">Active</Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDateTime(row.createdAt)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.lastUsedAt ? formatDateTime(row.lastUsedAt) : "Never"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-wrap justify-end gap-2">
                  {row.revokedAt ? (
                    <Button
                      disabled={isPending}
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(row)}
                    >
                      Delete
                    </Button>
                  ) : (
                    <>
                      <Button
                        disabled={isPending}
                        size="sm"
                        variant="outline"
                        onClick={() => handleRotate(row)}
                      >
                        Rotate
                      </Button>
                      <Button
                        disabled={isPending}
                        size="sm"
                        variant="outline"
                        onClick={() => handleRevoke(row)}
                      >
                        Revoke
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ConfirmDialog />
    </>
  );
}
