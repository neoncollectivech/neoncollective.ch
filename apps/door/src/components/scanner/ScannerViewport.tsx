import type { RefObject } from "react";

type ScannerViewportProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
};

export function ScannerViewport({ videoRef }: ScannerViewportProps) {
  return (
    <div className="absolute inset-0">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="aspect-square w-[min(72vw,72vh)] rounded-lg border-2 border-white/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
    </div>
  );
}
