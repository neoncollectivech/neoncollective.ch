import { useState } from "react";
import { Vibrate } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  areScanHapticsUnlocked,
  isVibrationApiPresent,
  unlockAndTestScanHaptics,
} from "@/lib/scan-haptic";

export function HapticsEnableBanner() {
  const [dismissed, setDismissed] = useState(() => areScanHapticsUnlocked());
  const [testFailed, setTestFailed] = useState(false);

  if (dismissed) {
    return null;
  }

  const vibrateSupported = isVibrationApiPresent();

  const handleEnable = () => {
    setTestFailed(false);

    if (vibrateSupported) {
      const ok = unlockAndTestScanHaptics();

      if (!ok) {
        setTestFailed(true);

        return;
      }
    } else {
      unlockAndTestScanHaptics();
    }

    setDismissed(true);
    setTestFailed(false);
  };

  return (
    <div className="absolute inset-x-3 top-14 z-20 rounded-md border border-primary/50 bg-card/95 p-3 shadow-lg backdrop-blur-sm">
      <p className="text-sm font-medium">Enable scan feedback</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {vibrateSupported
          ? "Android needs a tap before vibration works. Tap below — you should feel a short buzz."
          : "This browser does not support vibration; you will hear short beeps instead after tapping."}
      </p>
      {testFailed ? (
        <p className="mt-2 text-xs text-amber-400">
          Vibration was blocked. Check system sound/vibration settings (not
          silent / DND), then try again.
        </p>
      ) : null}
      <Button
        className="mt-3 w-full"
        size="sm"
        type="button"
        onClick={handleEnable}
      >
        <Vibrate className="h-4 w-4" />
        Enable haptics
      </Button>
    </div>
  );
}
