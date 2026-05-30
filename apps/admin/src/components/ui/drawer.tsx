import { X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DrawerContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

function useDrawerContext() {
  const ctx = React.useContext(DrawerContext);

  if (!ctx) {
    throw new Error("Drawer components must be used within Drawer");
  }

  return ctx;
}

type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function Drawer({ open, onOpenChange, children }: DrawerProps) {
  return (
    <DrawerContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function DrawerContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDialogElement>) {
  const { open, onOpenChange } = useDrawerContext();
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = ref.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cn(
        "m-0 h-full max-h-full w-full max-w-md border-l border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/80 open:fixed open:inset-y-0 open:right-0 open:z-50 open:flex open:flex-col",
        className,
      )}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClose={() => onOpenChange(false)}
      {...props}
    >
      <div className="flex h-full flex-col overflow-y-auto p-6">{children}</div>
      <Button
        aria-label="Close"
        className="absolute right-4 top-4"
        size="sm"
        type="button"
        variant="ghost"
        onClick={() => onOpenChange(false)}
      >
        <X className="h-4 w-4" />
      </Button>
    </dialog>
  );
}

export function DrawerHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 pr-8", className)}
      {...props}
    />
  );
}

export function DrawerTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

export function DrawerDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}
