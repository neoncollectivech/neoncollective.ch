import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ApiKeyTokenDialogProps = {
  open: boolean;
  token: string | null;
  label: string;
  onOpenChange: (open: boolean) => void;
};

async function copyToken(token: string) {
  await navigator.clipboard.writeText(token);
  toast.success("Token copied to clipboard");
}

export function ApiKeyTokenDialog({
  open,
  token,
  label,
  onOpenChange,
}: ApiKeyTokenDialogProps) {
  const [copied, setCopied] = useState(false);

  function handleClose(next: boolean) {
    if (!next) {
      setCopied(false);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API key created</DialogTitle>
          <DialogDescription>
            Copy the token for <span className="font-medium">{label}</span> now.
            It will not be shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input readOnly className="font-mono text-xs" value={token ?? ""} />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!token) {
                return;
              }
              void copyToken(token);
              setCopied(true);
            }}
          >
            Copy
          </Button>
        </div>
        <DialogFooter>
          <Button disabled={!copied} onClick={() => handleClose(false)}>
            {copied ? "Done" : "Copy token to continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
