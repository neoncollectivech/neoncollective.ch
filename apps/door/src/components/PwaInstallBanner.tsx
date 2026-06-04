import { useState } from "react";
import { Share, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  dismissIosInstallHint,
  shouldShowIosInstallHint,
} from "@/lib/pwa-install";

export function PwaInstallBanner() {
  const [visible, setVisible] = useState(shouldShowIosInstallHint);

  if (!visible) {
    return null;
  }

  return (
    <div
      aria-label="Install NEON Door"
      className="border-b border-amber-500/40 bg-amber-950/90 px-3 py-3 text-amber-50"
      role="region"
    >
      <div className="mx-auto flex max-w-lg items-start gap-3">
        <Share aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <p className="font-semibold">Install NEON Door on this iPhone</p>
          <p className="text-amber-100/90">
            Tap <strong>Share</strong> <span aria-hidden>(□↑)</span> at the
            bottom of Safari, then <strong>Add to Home Screen</strong>. iOS does
            not show an automatic install button.
          </p>
        </div>
        <Button
          aria-label="Dismiss install instructions"
          className="shrink-0 text-amber-50 hover:bg-amber-800/60"
          size="icon"
          type="button"
          variant="ghost"
          onClick={() => {
            dismissIosInstallHint();
            setVisible(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
