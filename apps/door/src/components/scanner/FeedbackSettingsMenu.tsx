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
  enableSoundFeedbackInUserGesture,
  getFeedbackDiagnostics,
  getFeedbackPreferences,
  resetScanFeedbackPermission,
  setFeedbackPreferences,
  testFeedbackInUserGesture,
  type FeedbackKind,
} from "@/lib/scan-feedback";

const TEST_ACTIONS: { kind: FeedbackKind; label: string }[] = [
  { kind: "scan", label: "Scan detected" },
  { kind: "success", label: "Check-in accepted" },
  { kind: "error", label: "Invalid / rejected" },
  { kind: "duplicate", label: "Duplicate scan" },
];

export function FeedbackSettingsMenu() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(getFeedbackPreferences);
  const [diagnostics, setDiagnostics] = useState(getFeedbackDiagnostics);

  const refresh = useCallback(() => {
    setPrefs(getFeedbackPreferences());
    setDiagnostics(getFeedbackDiagnostics());
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);

    if (next) {
      refresh();
    }
  };

  const toggleSound = () => {
    const next = setFeedbackPreferences({ sound: !prefs.sound });

    setPrefs(next);
    toast.message(`Sound ${next.sound ? "on" : "off"}`);
  };

  const handleEnableSound = () => {
    const result = enableSoundFeedbackInUserGesture();

    refresh();

    if (!result.played) {
      toast.error(
        "Sound could not play. Tap Enable sound again or check device mute settings.",
      );

      return;
    }

    toast.success("Sound feedback enabled.");
  };

  const handleTest = (kind: FeedbackKind, label: string) => {
    testFeedbackInUserGesture(kind);
    refresh();
    toast.success(`Testing: ${label}`);
  };

  const handleReset = () => {
    resetScanFeedbackPermission();
    refresh();
    toast.message("Sound permission reset — tap Enable sound again.");
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
            Enable sound once per session (required on iOS). Use the test
            buttons to preview each scan outcome.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sound
            </p>
            <Button
              className="w-full justify-start"
              type="button"
              variant={prefs.sound ? "default" : "outline"}
              onClick={toggleSound}
            >
              Sound: {prefs.sound ? "On" : "Off"}
            </Button>
            <Button
              className="w-full"
              type="button"
              onPointerDown={handleEnableSound}
            >
              Enable sound & test
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
              Test sounds
            </p>
            {TEST_ACTIONS.map(({ kind, label }) => (
              <Button
                key={kind}
                className="w-full justify-start"
                type="button"
                variant="outline"
                onPointerDown={() => handleTest(kind, label)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p>Audio context: {diagnostics.audioContextState ?? "n/a"}</p>
            <p>Unlocked: {diagnostics.unlocked ? "yes" : "no"}</p>
            <p>Sound enabled: {diagnostics.soundEnabled ? "yes" : "no"}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
