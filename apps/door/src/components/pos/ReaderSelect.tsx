import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { posApi } from "@/hooks/use-pos-api/api";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  getDoorSessionConfig,
  setDoorReaderConfig,
} from "@/lib/storage/session-config";
import { cn } from "@/lib/utils";

const VIRTUAL_SOLO_URL = "https://virtual-solo.sumup.com/";

type ReaderSelectProps = {
  onSelected: () => void;
};

export function ReaderSelect({ onSelected }: ReaderSelectProps) {
  const session = getDoorSessionConfig();
  const queryClient = useQueryClient();
  const [pairingCode, setPairingCode] = useState("");
  const [readerName, setReaderName] = useState("Virtual");
  const readersQuery = useQuery(posApi.readers.list({ pollWhileOffline: true }));
  const pairMutation = useMutation({
    ...posApi.readers.pair(),
    onSuccess: async (reader) => {
      setPairingCode("");
      await queryClient.invalidateQueries({ queryKey: posApi.keys.readers() });
      toast.success(`Paired ${reader.name}. Keep Virtual Solo open until status is ONLINE.`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not pair reader."));
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
  const merchantCode =
    readersQuery.data?.sumup.configuredMerchantCode ?? "…";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pair Virtual Solo (dev)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              Open{" "}
              <a
                className="text-primary underline"
                href={VIRTUAL_SOLO_URL}
                rel="noreferrer"
                target="_blank"
              >
                Virtual Solo
              </a>{" "}
              first → Get started → copy the pairing code (do not close the tab).
            </li>
            <li>
              Paste the code below and pair (merchant{" "}
              <code className="text-foreground">{merchantCode}</code>).
            </li>
            <li>
              Wait here until status flips to <strong>ONLINE</strong> (Virtual Solo
              “Ready” alone is not enough — SumUp Cloud API must agree).
            </li>
            <li>
              Delete extra stale readers in SumUp Dashboard if you paired more than once.
            </li>
          </ol>
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
                placeholder="From Virtual Solo"
                value={pairingCode}
                onChange={(event) => setPairingCode(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="readerName">Reader name</Label>
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
              {pairMutation.isPending ? "Pairing…" : "Pair reader"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {readers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No Solo readers</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Pair Virtual Solo above, then select the reader here.
          </CardContent>
        </Card>
      ) : (
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
              const offline = !reader.online;

              return (
                <Button
                  key={reader.id}
                  className={cn(
                    "h-auto w-full justify-start py-3",
                    selected && "ring-2 ring-primary",
                  )}
                  disabled={offline}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  onClick={() => {
                    setDoorReaderConfig({
                      readerId: reader.id,
                      readerName: reader.name,
                    });
                    onSelected();
                  }}
                >
                  <span className="flex flex-col items-start gap-0.5 text-left">
                    <span>{reader.name}</span>
                    <span className="text-xs opacity-80">
                      {reader.connectionStatus ?? reader.status ?? "unknown"}
                      {reader.deviceIdentifier && offline
                        ? ` · ${reader.deviceIdentifier}`
                        : null}
                      {offline
                        ? " — keep Virtual Solo tab open until ONLINE"
                        : " — ready"}
                    </span>
                  </span>
                </Button>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
