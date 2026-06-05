import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { posApi } from "@/hooks/use-pos-api/api";
import {
  getDoorSessionConfig,
  setDoorReaderConfig,
} from "@/lib/storage/session-config";
import { cn } from "@/lib/utils";

type ReaderSelectProps = {
  onSelected: () => void;
};

export function ReaderSelect({ onSelected }: ReaderSelectProps) {
  const session = getDoorSessionConfig();
  const readersQuery = useQuery(posApi.readers.list());

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

  const readers = readersQuery.data ?? [];

  if (readers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">No Solo readers</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Pair a Solo reader via SumUp Cloud API, then return here.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Solo reader</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {readers.map((reader) => {
          const selected = session?.readerId === reader.id;

          return (
            <Button
              key={reader.id}
              className={cn(
                "h-auto w-full justify-start py-3",
                selected && "ring-2 ring-primary",
              )}
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
                {reader.status ? (
                  <span className="text-xs opacity-80">{reader.status}</span>
                ) : null}
              </span>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
