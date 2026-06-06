import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  INVITEES_CSV_TEMPLATE,
  ParseInviteesCsvError,
  parseInviteesCsv,
  type InviteeUpsertPayload,
} from "@/lib/parse-invitees-csv";

type InviteeBulkImportProps = {
  disabled?: boolean;
  isPending?: boolean;
  onImport: (invitees: InviteeUpsertPayload[]) => void;
};

export function InviteeBulkImport({
  disabled,
  isPending,
  onImport,
}: InviteeBulkImportProps) {
  const [csv, setCsv] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    try {
      const invitees = parseInviteesCsv(csv);

      onImport(invitees);
    } catch (e) {
      const message =
        e instanceof ParseInviteesCsvError ? e.message : "Invalid CSV";

      toast.error(message);
    }
  };

  const loadFile = (file: File) => {
    const reader = new FileReader();

    reader.onload = () => {
      setCsv(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => toast.error("Could not read file");
    reader.readAsText(file);
  };

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        Bulk import (CSV)
      </summary>
      <div className="mt-2 space-y-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Example</p>
          <pre className="overflow-x-auto rounded-md border border-input bg-muted/30 p-2 text-xs font-mono text-foreground/80 whitespace-pre">
            {INVITEES_CSV_TEMPLATE}
          </pre>
        </div>
        <Textarea
          className="min-h-28 font-mono"
          placeholder="Paste or upload CSV…"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={fileRef}
            accept=".csv,text/csv"
            className="hidden"
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];

              if (file) loadFile(file);
              e.target.value = "";
            }}
          />
          <Button
            disabled={disabled}
            size="sm"
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
          >
            Choose file
          </Button>
          <Button
            disabled={disabled}
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => setCsv(INVITEES_CSV_TEMPLATE)}
          >
            Insert template
          </Button>
          <Button
            disabled={!csv.trim() || disabled || isPending}
            onClick={handleImport}
          >
            {isPending ? "Importing…" : "Import invitees"}
          </Button>
        </div>
      </div>
    </details>
  );
}
