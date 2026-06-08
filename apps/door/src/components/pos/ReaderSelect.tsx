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
  isSumUpAppSwitchReader,
  SUMUP_APP_SWITCH_READER_ID,
  SUMUP_APP_SWITCH_READER_NAME,
} from "@/lib/sumup-app-switch";
import {
  clearDoorReaderConfig,
  getDoorSessionConfig,
  setDoorReaderConfig,
} from "@/lib/storage/session-config";
import { cn } from "@/lib/utils";

type ReaderSelectProps = {
  mode: "select" | "change";
  onSelected: () => void;
  onReaderRemoved?: () => void;
};

export function ReaderSelect({
  mode,
  onSelected,
  onReaderRemoved,
}: ReaderSelectProps) {
  const session = getDoorSessionConfig();
  const queryClient = useQueryClient();
  const [pairExpanded, setPairExpanded] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [readerName, setReaderName] = useState("Door");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const readersQuery = useQuery(
    posApi.readers.list({ pollWhileOffline: true }),
  );
  const pairMutation = useMutation({
    ...posApi.readers.pair(),
    onSuccess: async (reader) => {
      setPairingCode("");
      setPairExpanded(false);
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

  const heading =
    mode === "change" ? "Change card reader" : "Select card reader";

  if (readersQuery.isLoading) {
    return (
      <p className="text-muted-foreground text-sm">Loading card readers…</p>
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
  const hasOnlineReader = readers.some((reader) => reader.online);
  const tapToPaySelected = isSumUpAppSwitchReader(session?.readerId);
  const tapToPayLabel =
    readers.length > 0 ? "Use Tap to Pay instead" : "Use Tap to Pay";

  const selectTapToPay = () => {
    setConfirmDeleteId(null);
    setDoorReaderConfig({
      readerId: SUMUP_APP_SWITCH_READER_ID,
      readerName: SUMUP_APP_SWITCH_READER_NAME,
    });
    onSelected();
  };

  const selectReader = (reader: (typeof readers)[number]) => {
    if (!reader.online) {
      toast.error("Reader is offline. Check power and connection.");
    }
    setConfirmDeleteId(null);
    setDoorReaderConfig({
      readerId: reader.id,
      readerName: reader.name,
    });
    onSelected();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{heading}</h2>

      {readers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No card readers paired</p>
      ) : null}

      {readers.length > 0 && !hasOnlineReader ? (
        <p className="text-muted-foreground text-sm">No readers online</p>
      ) : null}

      {readers.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Card reader</CardTitle>
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
              const statusLabel = reader.online
                ? (reader.connectionStatus ?? reader.status ?? "ONLINE")
                : "OFFLINE";

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
                    onClick={() => selectReader(reader)}
                  >
                    <span className="flex w-full min-w-0 flex-col items-start gap-0.5 text-left">
                      <span className="w-full truncate">{reader.name}</span>
                      <span className="w-full truncate text-xs opacity-80">
                        {statusLabel}
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

      <div className="space-y-2">
        <Button
          className={cn("w-full", tapToPaySelected && "ring-2 ring-primary")}
          type="button"
          variant={tapToPaySelected ? "default" : "outline"}
          onClick={selectTapToPay}
        >
          {tapToPayLabel}
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          Requires SumUp app logged in on this device.
        </p>
      </div>

      {pairExpanded ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pair reader</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void pairMutation.mutateAsync({
                  pairingCode: pairingCode.trim(),
                  name: readerName.trim() || "Door",
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
                disabled={
                  pairMutation.isPending || pairingCode.trim().length < 8
                }
                type="submit"
              >
                {pairMutation.isPending ? "Pairing…" : "Pair"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button
          className="w-full"
          type="button"
          variant="outline"
          onClick={() => setPairExpanded(true)}
        >
          Pair new reader
        </Button>
      )}
    </div>
  );
}
