import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { adminApi } from "@/hooks/use-admin-api";
import { getApiErrorMessage } from "@/lib/api-error";

export function MaintenancePage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const previewQuery = useQuery(adminApi.maintenance.preview());
  const runMutation = useMutation(adminApi.maintenance.run());

  const preview = previewQuery.data;
  const totalRows = preview?.totalRows ?? 0;
  const canRun = totalRows > 0 && !runMutation.isPending;

  async function handleRunCleanup() {
    await runMutation.mutateAsync();
    setConfirmOpen(false);
    await previewQuery.refetch();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Maintenance</h2>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={previewQuery.isFetching}
            variant="outline"
            onClick={() => previewQuery.refetch()}
          >
            {previewQuery.isFetching ? <InlineSpinner /> : null}
            Refresh preview
          </Button>
          <Button disabled={!canRun} onClick={() => setConfirmOpen(true)}>
            Run cleanup
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deletion preview</CardTitle>
        </CardHeader>
        <CardContent>
          {previewQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading counts…</p>
          ) : previewQuery.isError ? (
            <p className="text-sm text-destructive">
              {getApiErrorMessage(previewQuery.error)}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                <span className="font-medium text-foreground">{totalRows}</span>{" "}
                rows would be deleted if you run cleanup now.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead className="text-right w-24">Rows</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(preview?.categories ?? []).map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.description}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {runMutation.data ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last run result</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Deleted{" "}
              <span className="font-medium text-foreground">
                {runMutation.data.totalDeleted}
              </span>{" "}
              rows.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right w-24">Deleted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runMutation.data.categories.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.deleted}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run database cleanup?</DialogTitle>
            <DialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-foreground">{totalRows}</span>{" "}
              rows across ephemeral tables. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm space-y-1 max-h-48 overflow-y-auto border border-border rounded-md p-3">
            {(preview?.categories ?? [])
              .filter((c) => c.count > 0)
              .map((c) => (
                <li key={c.key} className="flex justify-between gap-4">
                  <span>{c.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {c.count}
                  </span>
                </li>
              ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={runMutation.isPending}
              variant="destructive"
              onClick={() => void handleRunCleanup()}
            >
              {runMutation.isPending ? <InlineSpinner /> : null}
              Delete {totalRows} rows
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
