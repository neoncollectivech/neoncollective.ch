import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef } from "react";
import { List, LogOut } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

import { BrightScreenFallback } from "@/components/scanner/BrightScreenFallback";
import { ScanFeedbackOverlay } from "@/components/scanner/ScanFeedbackOverlay";
import { ScannerViewport } from "@/components/scanner/ScannerViewport";
import { TorchToggle } from "@/components/scanner/TorchToggle";
import { OutboxBadge } from "@/components/queue/OutboxBadge";
import { Button } from "@/components/ui/button";
import { doorApi, doorKeys } from "@/hooks/use-door-api";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useQrScanner } from "@/hooks/use-qr-scanner";
import { useScanFeedback } from "@/hooks/use-scan-feedback";
import { useTorch } from "@/hooks/use-torch";
import { normalizeAdmissionToken } from "@/lib/admission-token";
import { getApiErrorMessage } from "@/lib/api-error";
import { enqueueCheckIn } from "@/lib/storage/check-in-outbox";
import { startOutboxSyncScheduler } from "@/lib/storage/sync-outbox";
import { clearDoorSessionConfig } from "@/lib/storage/session-config";
import { cn } from "@/lib/utils";

export function ScanPage() {
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const feedback = useScanFeedback();
  const processingRef = useRef(false);
  const scanPaused =
    feedback.state === "submitting" ||
    feedback.state === "accepted" ||
    feedback.isCoolingDown();

  const checkInMutation = useMutation(doorApi.checkIn.submit());

  const handleCheckIn = useCallback(
    async (rawText: string) => {
      if (processingRef.current) {
        return;
      }

      const token = normalizeAdmissionToken(rawText);

      if (!token) {
        return;
      }

      if (!feedback.onDecoded(token)) {
        return;
      }

      processingRef.current = true;
      feedback.onSubmitting();

      try {
        if (!navigator.onLine) {
          await enqueueCheckIn(token);
          feedback.onAccepted("Queued — will sync when online");
          void queryClient.invalidateQueries({
            queryKey: doorKeys.outbox.stats(),
          });

          return;
        }

        await checkInMutation.mutateAsync(token);
        feedback.onAccepted();
      } catch (error) {
        if (!navigator.onLine) {
          await enqueueCheckIn(token);
          feedback.onAccepted("Queued — will sync when online");
          void queryClient.invalidateQueries({
            queryKey: doorKeys.outbox.stats(),
          });

          return;
        }

        if (axios.isAxiosError(error) && !error.response) {
          await enqueueCheckIn(token);
          feedback.onAccepted("Queued — will sync when online");
          void queryClient.invalidateQueries({
            queryKey: doorKeys.outbox.stats(),
          });

          return;
        }

        feedback.onRejected(getApiErrorMessage(error, "Check-in failed"));
      } finally {
        processingRef.current = false;
      }
    },
    [checkInMutation, feedback, queryClient],
  );

  const { videoRef, videoTrack, ready, cameraError } = useQrScanner({
    enabled: true,
    paused: scanPaused,
    onDecoded: (text) => {
      void handleCheckIn(text);
    },
    onError: (message) => {
      toast.error(message);
    },
  });

  const torch = useTorch(videoTrack);

  useEffect(() => {
    const stop = startOutboxSyncScheduler(() => {
      void queryClient.invalidateQueries({ queryKey: doorKeys.outbox.stats() });
    });

    return stop;
  }, [queryClient]);

  const handleSignOut = () => {
    clearDoorSessionConfig();
    navigate("/setup", { replace: true });
  };

  return (
    <div className="relative flex h-[100dvh] flex-col bg-black">
      <header className="relative z-10 flex items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-wide">NEON Door</span>
          {!online ? (
            <span className="text-xs text-amber-400">Offline</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <OutboxBadge />
          <Button asChild size="icon" variant="ghost">
            <Link aria-label="View queue" to="/queue">
              <List className="h-5 w-5" />
            </Link>
          </Button>
          <Button
            aria-label="Sign out"
            size="icon"
            variant="ghost"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <ScannerViewport videoRef={videoRef} />
        {torch.brightScreen ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-white/80"
          />
        ) : null}
        <ScanFeedbackOverlay
          message={feedback.message}
          state={feedback.state}
        />
        {cameraError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-6 text-center text-sm">
            {cameraError}
          </div>
        ) : null}
        {!ready && !cameraError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm">
            Starting scanner…
          </div>
        ) : null}
      </div>

      <footer
        className={cn(
          "relative z-10 flex items-center justify-between gap-2 border-t border-border p-3",
        )}
      >
        <BrightScreenFallback
          active={torch.brightScreen}
          onToggle={torch.toggleBrightScreen}
        />
        <TorchToggle
          torchOn={torch.torchOn}
          torchSupported={torch.torchSupported}
          onToggleTorch={torch.toggleTorch}
        />
      </footer>
    </div>
  );
}
