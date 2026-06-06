import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { usePwaUpdate } from "@/hooks/use-pwa-update";

export function PwaUpdateActions() {
  const { needRefresh, checking, checkForUpdate, applyUpdate } = usePwaUpdate();

  return (
    <div className="space-y-2 px-2">
      <p className="text-xs text-muted-foreground">
        Build {__ADMIN_BUILD_LABEL__}
        {needRefresh ? " · update ready" : ""}
      </p>
      {needRefresh ? (
        <Button
          className="w-full"
          size="sm"
          type="button"
          onClick={() => applyUpdate()}
        >
          Install update
        </Button>
      ) : null}
      <Button
        className="w-full"
        disabled={checking}
        size="sm"
        type="button"
        variant="outline"
        onClick={() => {
          void checkForUpdate().then((result) => {
            if (result === "unsupported") {
              toast.message("Updates are not available in this browser.");

              return;
            }

            if (result === "available") {
              toast.info("Update ready — tap Install update.");

              return;
            }

            toast.success("You are on the latest version.");
          });
        }}
      >
        {checking ? "Checking…" : "Check for updates"}
      </Button>
    </div>
  );
}
