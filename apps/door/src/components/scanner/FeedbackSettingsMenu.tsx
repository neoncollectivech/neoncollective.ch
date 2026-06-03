import { useCallback, useState } from "react";
import { Settings } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  enableAllFeedbackInUserGesture,
  getFeedbackPreferences,
  getHapticDiagnostics,
  resetScanHapticsPermission,
  setFeedbackPreferences,
  testFeedbackInUserGesture,
  type FeedbackKind,
} from "@/lib/scan-haptic";

const TEST_ACTIONS: { kind: FeedbackKind; label: string }[] = [
  { kind: "scan", label: "Scan detected" },
  { kind: "success", label: "Check-in accepted" },
  { kind: "error", label: "Invalid / rejected" },
  { kind: "duplicate", label: "Duplicate scan" },
];

export function FeedbackSettingsMenu() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(getFeedbackPreferences);
  const [diagnostics, setDiagnostics] = useState(getHapticDiagnostics);

  const refresh = useCallback(() => {
    setPrefs(getFeedbackPreferences());
    setDiagnostics(getHapticDiagnostics());
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);

    if (next) {
      refresh();
    }
  };

  const toggleVibration = () => {
    const next = setFeedbackPreferences({ vibration: !prefs.vibration });

    setPrefs(next);
    toast.message(`Vibration ${next.vibration ? "on" : "off"}`);
  };

  const toggleSound = () => {
    const next = setFeedbackPreferences({ sound: !prefs.sound });

    setPrefs(next);
    toast.message(`Sound ${next.sound ? "on" : "off"}`);
  };

  const handleEnableAll = () => {
    const result = enableAllFeedbackInUserGesture();

    refresh();

    if (!result.vibrated && result.preferences.vibration) {
      toast.warning(
        "Vibration API accepted but the motor may be blocked — check system sound/vibration settings.",
      );

      return;
    }

    toast.success("Feedback enabled — you should feel/hear the test pattern.");
  };

  const handleTest = (kind: FeedbackKind, label: string) => {
    testFeedbackInUserGesture(kind);
    refresh();
    toast.message(`Testing: ${label}`);
  };

  const handleReset = () => {
    resetScanHapticsPermission();
    refresh();
    toast.message("Feedback permission reset — tap Enable all again.");
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button aria-label="Feedback settings" size="icon" variant="ghost">
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Scan feedback</SheetTitle>
          <SheetDescription>
            Enable vibration and sound, then test each pattern. On Android
            Chrome, feedback works best after tapping Enable or any test button.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Permissions
            </p>
            <Button
              className="w-full justify-start"
              type="button"
              variant={prefs.vibration ? "default" : "outline"}
              onClick={toggleVibration}
            >
              Vibration: {prefs.vibration ? "On" : "Off"}
            </Button>
            <Button
              className="w-full justify-start"
              type="button"
              variant={prefs.sound ? "default" : "outline"}
              onClick={toggleSound}
            >
              Sound: {prefs.sound ? "On" : "Off"}
            </Button>
            <Button className="w-full" type="button" onClick={handleEnableAll}>
              Enable all & test
            </Button>
            <Button
              className="w-full"
              type="button"
              variant="outline"
              onClick={handleReset}
            >
              Reset permission
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Test patterns
            </p>
            {TEST_ACTIONS.map(({ kind, label }) => (
              <Button
                key={kind}
                className="w-full justify-start"
                type="button"
                variant="outline"
                onClick={() => handleTest(kind, label)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p>
              Vibration API: {diagnostics.vibrationApiPresent ? "yes" : "no"}
            </p>
            <p>Audio context: {diagnostics.audioContextState ?? "n/a"}</p>
            <p>Unlocked: {diagnostics.unlocked ? "yes" : "no"}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
