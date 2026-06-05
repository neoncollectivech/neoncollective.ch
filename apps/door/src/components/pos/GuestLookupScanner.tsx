import { useCallback } from "react";

import { ScannerViewport } from "@/components/scanner/ScannerViewport";
import { Button } from "@/components/ui/button";
import { useQrScanner } from "@/hooks/use-qr-scanner";
import { normalizeAdmissionCredential } from "@/lib/admission-credential";

type GuestLookupScannerProps = {
  onCredential: (credential: string) => void;
  onClose: () => void;
};

export function GuestLookupScanner({
  onCredential,
  onClose,
}: GuestLookupScannerProps) {
  const handleDecoded = useCallback(
    (rawText: string) => {
      const credential = normalizeAdmissionCredential(rawText);

      if (!credential) {
        return;
      }
      onCredential(credential);
    },
    [onCredential],
  );

  const { videoRef, ready, cameraError } = useQrScanner({
    enabled: true,
    paused: false,
    onDecoded: handleDecoded,
  });

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative min-h-56 overflow-hidden rounded-lg bg-black">
        <ScannerViewport videoRef={videoRef} />
        {!ready && !cameraError ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
            Starting scanner…
          </div>
        ) : null}
        {cameraError ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white">
            {cameraError}
          </div>
        ) : null}
      </div>
      <p className="text-muted-foreground text-center text-sm">
        Scan the guest&apos;s admission QR to look them up.
      </p>
      <Button type="button" variant="outline" onClick={onClose}>
        Cancel scan
      </Button>
    </div>
  );
}
