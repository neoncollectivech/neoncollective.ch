import type {
  ScannerInitMessage,
  ScannerWorkerInMessage,
  ScannerWorkerOutMessage,
} from "@/scanning/scanner-protocol";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  SCAN_HEIGHT_DEFAULT,
  SCAN_HEIGHT_SMALL,
  SCAN_WIDTH_DEFAULT,
  SCAN_WIDTH_SMALL,
} from "@/scanning/scanner-protocol";
import ScannerWorker from "@/scanning/scanner.worker?worker";

const WASM_BASE = import.meta.env.BASE_URL;
const FRAME_P95_WINDOW = 24;
const DOWNGRADE_P95_MS = 33;

type UseQrScannerOptions = {
  enabled: boolean;
  paused: boolean;
  onDecoded: (text: string) => void;
  onError?: (message: string) => void;
};

export function useQrScanner({
  enabled,
  paused,
  onDecoded,
  onError,
}: UseQrScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const rafRef = useRef<number | null>(null);
  const capturingRef = useRef(false);
  const decodeLatenciesRef = useRef<number[]>([]);
  const scanSizeRef = useRef({
    width: SCAN_WIDTH_DEFAULT,
    height: SCAN_HEIGHT_DEFAULT,
  });
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const onDecodedRef = useRef(onDecoded);
  const onErrorRef = useRef(onError);
  const pausedRef = useRef(paused);
  const readyRef = useRef(ready);

  onDecodedRef.current = onDecoded;
  onErrorRef.current = onError;
  pausedRef.current = paused;
  readyRef.current = ready;

  const postToWorker = useCallback((msg: ScannerWorkerInMessage) => {
    workerRef.current?.postMessage(msg);
  }, []);

  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);

    if (pausedRef.current || capturingRef.current || !readyRef.current) {
      return;
    }

    const video = videoRef.current;

    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    capturingRef.current = true;

    void createImageBitmap(video)
      .then((bitmap) => {
        workerRef.current?.postMessage(
          { type: "frame", bitmap } satisfies ScannerWorkerInMessage,
          [bitmap],
        );
      })
      .catch(() => undefined)
      .finally(() => {
        capturingRef.current = false;
      });
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const worker = new ScannerWorker();

    workerRef.current = worker;

    const onMessage = (event: MessageEvent<ScannerWorkerOutMessage>) => {
      const msg = event.data;

      if (msg.type === "ready") {
        readyRef.current = true;
        setReady(true);
        postToWorker({ type: "start" });

        return;
      }

      if (msg.type === "decoded") {
        const start = performance.now();

        onDecodedRef.current(msg.text);
        const elapsed = performance.now() - start;
        const samples = decodeLatenciesRef.current;

        samples.push(elapsed);

        if (samples.length > FRAME_P95_WINDOW) {
          samples.shift();
        }

        if (samples.length >= FRAME_P95_WINDOW) {
          const sorted = [...samples].sort((a, b) => a - b);
          const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;

          if (
            p95 > DOWNGRADE_P95_MS &&
            scanSizeRef.current.width === SCAN_WIDTH_DEFAULT
          ) {
            scanSizeRef.current = {
              width: SCAN_WIDTH_SMALL,
              height: SCAN_HEIGHT_SMALL,
            };
            postToWorker({
              type: "resize",
              width: SCAN_WIDTH_SMALL,
              height: SCAN_HEIGHT_SMALL,
            });
          }
        }

        return;
      }

      if (msg.type === "error") {
        onErrorRef.current?.(msg.message);
      }
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage({
      type: "init",
      wasmBaseUrl: WASM_BASE,
      width: SCAN_WIDTH_DEFAULT,
      height: SCAN_HEIGHT_DEFAULT,
    } satisfies ScannerInitMessage);

    return () => {
      worker.removeEventListener("message", onMessage);
      worker.postMessage({ type: "stop" });
      worker.terminate();
      workerRef.current = null;
      readyRef.current = false;
      setReady(false);
    };
    // Worker + WASM init once per mount; callbacks read from refs (stable identity).
  }, [enabled, postToWorker]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    void navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());

          return;
        }

        streamRef.current = stream;
        const track = stream.getVideoTracks()[0] ?? null;

        setVideoTrack(track);

        const video = videoRef.current;

        if (video) {
          video.srcObject = stream;
          void video.play();
        }
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : "Camera permission denied";

        setCameraError(msg);
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setVideoTrack(null);

      const video = videoRef.current;

      if (video) {
        video.srcObject = null;
      }
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !ready) {
      return;
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, ready, tick]);

  useEffect(() => {
    if (paused) {
      postToWorker({ type: "pause" });
    } else if (ready) {
      postToWorker({ type: "resume" });
    }
  }, [paused, ready, postToWorker]);

  return {
    videoRef,
    videoTrack,
    ready,
    cameraError,
  };
}
