import type { ScanFeedbackState } from "@/hooks/use-scan-feedback";

import { cn } from "@/lib/utils";

const STATE_STYLES: Record<
  ScanFeedbackState,
  { bg: string; label: string } | null
> = {
  idle: null,
  decoded: { bg: "bg-white/20", label: "Reading…" },
  submitting: { bg: "bg-amber-500/30", label: "Checking in…" },
  accepted: { bg: "bg-emerald-500/40", label: "Accepted" },
  rejected: { bg: "bg-red-600/40", label: "Rejected" },
  duplicate: { bg: "bg-yellow-500/30", label: "Already scanned" },
};

type ScanFeedbackOverlayProps = {
  state: ScanFeedbackState;
  message: string | null;
};

export function ScanFeedbackOverlay({
  state,
  message,
}: ScanFeedbackOverlayProps) {
  const style = STATE_STYLES[state];

  if (!style) {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-48 w-48 rounded-lg border-2 border-primary/80 shadow-[0_0_24px_rgb(255_49_49/0.4)]" />
      </div>
    );
  }

  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute inset-0 flex flex-col items-center justify-center transition-colors duration-150",
        style.bg,
      )}
      role="status"
    >
      <p className="text-lg font-semibold text-foreground drop-shadow-md">
        {message ?? style.label}
      </p>
    </div>
  );
}
