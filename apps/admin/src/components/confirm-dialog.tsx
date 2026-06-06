import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineSpinner } from "@/components/ui/inline-spinner";

export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
};

type ConfirmDialogState = ConfirmDialogOptions | null;

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>(null);
  const [pending, setPending] = useState(false);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    setState(options);
  }, []);

  const close = useCallback(() => {
    if (!pending) {
      setState(null);
    }
  }, [pending]);

  const handleConfirm = useCallback(async () => {
    if (!state) {
      return;
    }

    setPending(true);
    try {
      await state.onConfirm();
      setState(null);
    } finally {
      setPending(false);
    }
  }, [state]);

  function ConfirmDialogHost() {
    return (
      <Dialog
        open={state !== null}
        onOpenChange={(open) => {
          if (!open) {
            close();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{state?.title}</DialogTitle>
            {state?.description ? (
              <DialogDescription>{state.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <DialogFooter>
            <Button disabled={pending} variant="outline" onClick={close}>
              {state?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              disabled={pending}
              variant={state?.variant ?? "default"}
              onClick={() => void handleConfirm()}
            >
              {pending ? <InlineSpinner /> : null}
              {state?.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return { confirm, ConfirmDialog: ConfirmDialogHost };
}
