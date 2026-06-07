import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { posApi } from "@/hooks/use-pos-api/api";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  clearDoorReaderConfig,
  getDoorSessionConfig,
  setDoorReaderConfig,
} from "@/lib/storage/session-config";
import { cn } from "@/lib/utils";

const VIRTUAL_SOLO_URL = "https://virtual-solo.sumup.com/";

type ReaderSelectProps = {
  onSelected: () => void;
  onReaderRemoved?: () => void;
};

export function ReaderSelect({
  onSelected,
  onReaderRemoved,
}: ReaderSelectProps) {
  const session = getDoorSessionConfig();
  const queryClient = useQueryClient();
  const [pairingCode, setPairingCode] = useState("");
  const [readerName, setReaderName] = useState("Virtual");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const readersQuery = useQuery(
    posApi.readers.list({ pollWhileOffline: true }),
  );
  const pairMutation = useMutation({
    ...posApi.readers.pair(),
    onSuccess: async (reader) => {
      setPairingCode("");
      await queryClient.invalidateQueries({ queryKey: posApi.keys.readers() });
      toast.success(`Paired ${reader.name}.`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not pair reader."));
    },
  });
  const deleteMutation = useMutation({
    ...posApi.readers.delete(),
    onSuccess: async (_data, readerId) => {
      setConfirmDeleteId(null);
      if (session?.readerId === readerId) {
        clearDoorReaderConfig();
        onReaderRemoved?.();
      }
      await queryClient.invalidateQueries({ queryKey: posApi.keys.readers() });
      toast.success("Reader removed.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not delete reader."));
    },
  });

  if (readersQuery.isLoading) {
    return (
      <p className="text-muted-foreground text-sm">Loading Solo readers…</p>
    );
  }

  if (readersQuery.isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-sm">
            Could not load readers. Check SumUp configuration on the server.
          </p>
        </CardContent>
      </Card>
    );
  }

  const readers = readersQuery.data?.readers ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Pair reader</CardTitle>
          <a
            className="text-primary text-sm underline"
            href={VIRTUAL_SOLO_URL}
            rel="noreferrer"
            target="_blank"
          >
            Virtual Solo
          </a>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void pairMutation.mutateAsync({
                pairingCode: pairingCode.trim(),
                name: readerName.trim() || "Virtual",
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="pairingCode">Pairing code</Label>
              <Input
                autoComplete="off"
                id="pairingCode"
                value={pairingCode}
                onChange={(event) => setPairingCode(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="readerName">Name</Label>
              <Input
                id="readerName"
                value={readerName}
                onChange={(event) => setReaderName(event.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={pairMutation.isPending || pairingCode.trim().length < 8}
              type="submit"
            >
              {pairMutation.isPending ? "Pairing…" : "Pair"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {readers.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Solo reader</CardTitle>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => void readersQuery.refetch()}
            >
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {readers.map((reader) => {
              const selected = session?.readerId === reader.id;
              const confirmingDelete = confirmDeleteId === reader.id;

              return (
                <div key={reader.id} className="flex min-w-0 gap-2">
                  <Button
                    className={cn(
                      "h-auto min-w-0 flex-1 justify-start overflow-hidden py-3 whitespace-normal",
                      selected && "ring-2 ring-primary",
                    )}
                    disabled={deleteMutation.isPending}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    onClick={() => {
                      setConfirmDeleteId(null);
                      setDoorReaderConfig({
                        readerId: reader.id,
                        readerName: reader.name,
                      });
                      onSelected();
                    }}
                  >
                    <span className="flex w-full min-w-0 flex-col items-start gap-0.5 text-left">
                      <span className="w-full truncate">{reader.name}</span>
                      <span className="w-full truncate text-xs opacity-80">
                        {reader.connectionStatus ?? reader.status ?? "unknown"}
                        {reader.deviceIdentifier
                          ? ` · ${reader.deviceIdentifier}`
                          : null}
                      </span>
                    </span>
                  </Button>
                  {confirmingDelete ? (
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        disabled={deleteMutation.isPending}
                        size="sm"
                        type="button"
                        variant="destructive"
                        onClick={() => {
                          void deleteMutation.mutateAsync(reader.id);
                        }}
                      >
                        {deleteMutation.isPending ? "…" : "Delete"}
                      </Button>
                      <Button
                        disabled={deleteMutation.isPending}
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      aria-label={`Remove ${reader.name}`}
                      disabled={deleteMutation.isPending}
                      size="icon"
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmDeleteId(reader.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
