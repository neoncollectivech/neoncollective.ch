import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef } from "react";
import { List, LogOut } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

import { FeedbackSettingsMenu } from "@/components/scanner/FeedbackSettingsMenu";
import { BrightScreenFallback } from "@/components/scanner/BrightScreenFallback";
import { ScanFeedbackOverlay } from "@/components/scanner/ScanFeedbackOverlay";
import { ScannerViewport } from "@/components/scanner/ScannerViewport";
import { TorchToggle } from "@/components/scanner/TorchToggle";
import { OutboxBadge } from "@/components/queue/OutboxBadge";
import { Button } from "@/components/ui/button";
import { doorApi, doorKeys } from "@/hooks/use-door-api";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useQrScanner } from "@/hooks/use-qr-scanner";
import {
  isScannerLockedState,
  useScanFeedback,
} from "@/hooks/use-scan-feedback";
import { useTorch } from "@/hooks/use-torch";
import { normalizeAdmissionCredential } from "@/lib/admission-credential";
import { verifyAdmissionCredentialOffline } from "@/lib/admission-jwks";
import { getApiErrorMessage } from "@/lib/api-error";
import { enqueueCheckIn } from "@/lib/storage/check-in-outbox";
import {
  clearDoorSessionConfig,
  getDoorSessionConfig,
} from "@/lib/storage/session-config";
import { startOutboxSyncScheduler } from "@/lib/storage/sync-outbox";
import { unlockScanFeedback } from "@/lib/scan-feedback";
import { cn } from "@/lib/utils";

export function ScanPage() {
  const navigate = useNavigate();
  const session = getDoorSessionConfig();
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const feedback = useScanFeedback();
  const processingRef = useRef(false);
  const scanPaused =
    feedback.coolingDown || isScannerLockedState(feedback.state);

  const checkInMutation = useMutation(doorApi.checkIn.submit());

  const feedbackRef = useRef(feedback);

  feedbackRef.current = feedback;

  const handleCheckIn = useCallback(
    async (rawText: string) => {
      if (processingRef.current) {
        return;
      }

      const fb = feedbackRef.current;

      if (fb.coolingDown) {
        return;
      }

      fb.onScanned();

      const credential = normalizeAdmissionCredential(rawText);

      if (!credential) {
        fb.onInvalidAdmission(rawText);

        return;
      }

      if (!fb.onDecoded(credential)) {
        return;
      }

      const session = getDoorSessionConfig();

      if (!session) {
        fb.onRejected("Door is not configured.");

        return;
      }

      const offlineVerify = await verifyAdmissionCredentialOffline({
        credential,
        eventId: session.eventId,
      });

      if (!offlineVerify.ok) {
        const message =
          offlineVerify.reason === "jwks_missing"
            ? "Missing JWKS — re-run setup."
            : "Invalid admission credential.";

        fb.onRejected(message);

        return;
      }

      processingRef.current = true;
      fb.onSubmitting();

      const queueOffline = async () => {
        await enqueueCheckIn(credential);
        fb.onAccepted("Queued — will sync when online");
        void queryClient.invalidateQueries({
          queryKey: doorKeys.outbox.stats(),
        });
      };

      try {
        if (!navigator.onLine) {
          await queueOffline();

          return;
        }

        await checkInMutation.mutateAsync(credential);
        fb.onAccepted();
      } catch (error) {
        if (!navigator.onLine) {
          await queueOffline();

          return;
        }

        if (axios.isAxiosError(error) && !error.response) {
          await queueOffline();

          return;
        }

        if (axios.isAxiosError(error) && error.response?.status === 404) {
          fb.onDuplicate();

          return;
        }

        fb.onRejected(getApiErrorMessage(error, "Check-in failed"));
      } finally {
        processingRef.current = false;
      }
    },
    [checkInMutation, queryClient],
  );

  const handleCheckInRef = useRef(handleCheckIn);

  handleCheckInRef.current = handleCheckIn;

  const onScanDecoded = useCallback((text: string) => {
    void handleCheckInRef.current(text);
  }, []);

  const onScanError = useCallback((message: string) => {
    toast.error(message);
  }, []);

  const { videoRef, videoTrack, ready, cameraError } = useQrScanner({
    enabled: true,
    paused: scanPaused,
    onDecoded: onScanDecoded,
    onError: onScanError,
  });

  const torch = useTorch(videoTrack);

  useEffect(() => {
    const stop = startOutboxSyncScheduler(() => {
      void queryClient.invalidateQueries({ queryKey: doorKeys.outbox.stats() });
    });

    return stop;
  }, [queryClient]);

  useEffect(() => {
    document.documentElement.classList.add("door-scan-locked");

    return () => {
      document.documentElement.classList.remove("door-scan-locked");
    };
  }, []);

  useEffect(() => {
    const onGesture = () => unlockScanFeedback();

    document.addEventListener("pointerdown", onGesture, {
      once: true,
      passive: true,
    });

    return () => {
      document.removeEventListener("pointerdown", onGesture);
    };
  }, []);

  const handleSignOut = () => {
    clearDoorSessionConfig();
    navigate("/setup", { replace: true });
  };

  return (
    <div className="fixed inset-0 z-0 flex h-[100svh] max-h-[100svh] flex-col overflow-hidden bg-black">
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-2 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold tracking-wide">NEON Door</span>
          {session?.eventTitle ? (
            <p className="truncate text-xs text-muted-foreground">
              {session.eventTitle}
            </p>
          ) : null}
          {!online ? (
            <span className="text-xs text-amber-400">Offline</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <OutboxBadge />
          <FeedbackSettingsMenu />
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

      <div className="relative min-h-0 flex-1 overflow-hidden">
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
          "relative z-10 flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3",
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
