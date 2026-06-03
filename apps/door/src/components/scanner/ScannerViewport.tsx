import type { RefObject } from "react";

type ScannerViewportProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
};

export function ScannerViewport({ videoRef }: ScannerViewportProps) {
  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
