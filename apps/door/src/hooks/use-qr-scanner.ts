import type {
  ScannerInitMessage,
  ScannerWorkerInMessage,
  ScannerWorkerOutMessage,
} from "@/scanning/scanner-protocol";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  SCAN_HEIGHT_DEFAULT,
  SCAN_WIDTH_DEFAULT,
} from "@/scanning/scanner-protocol";
import ScannerWorker from "@/scanning/scanner.worker?worker";
import { applyCameraEnhancements } from "@/lib/camera-enhancements";
import {
  createNativeQrDetector,
  detectQrFromVideo,
} from "@/lib/native-barcode-detector";

const WASM_BASE = import.meta.env.BASE_URL;

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
  const nativeDetectorRef = useRef<BarcodeDetector | null>(null);
  const useNativeRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const capturingRef = useRef(false);
  const lastPostedTokenRef = useRef("");
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const onDecodedRef = useRef(onDecoded);
  const onErrorRef = useRef(onError);
  const pausedRef = useRef(paused);
  const readyRef = useRef(ready);
  const workerReadyRef = useRef(false);

  onDecodedRef.current = onDecoded;
  onErrorRef.current = onError;
  pausedRef.current = paused;
  readyRef.current = ready;

  const postDecoded = useCallback((text: string) => {
    if (!text || text === lastPostedTokenRef.current) {
      return;
    }

    lastPostedTokenRef.current = text;
    onDecodedRef.current(text);
  }, []);

  const postToWorker = useCallback((msg: ScannerWorkerInMessage) => {
    workerRef.current?.postMessage(msg);
  }, []);

  const trySetReady = useCallback(() => {
    const canScan = workerReadyRef.current || useNativeRef.current;

    if (canScan && !readyRef.current) {
      readyRef.current = true;
      setReady(true);
    }
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

    const nativeDetector = nativeDetectorRef.current;

    if (useNativeRef.current && nativeDetector) {
      void detectQrFromVideo(nativeDetector, video)
        .then((text) => {
          if (!text) {
            lastPostedTokenRef.current = "";

            return;
          }

          postDecoded(text);
        })
        .catch(() => undefined)
        .finally(() => {
          capturingRef.current = false;
        });

      return;
    }

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
  }, [postDecoded]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    void createNativeQrDetector().then((detector) => {
      if (cancelled) {
        return;
      }

      nativeDetectorRef.current = detector;
      useNativeRef.current = detector !== null;
      trySetReady();
    });

    const worker = new ScannerWorker();

    workerRef.current = worker;

    const onMessage = (event: MessageEvent<ScannerWorkerOutMessage>) => {
      const msg = event.data;

      if (msg.type === "ready") {
        workerReadyRef.current = true;
        postToWorker({ type: "start" });
        trySetReady();

        return;
      }

      if (msg.type === "decoded") {
        postDecoded(msg.text);

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
      cancelled = true;
      worker.removeEventListener("message", onMessage);
      worker.postMessage({ type: "stop" });
      worker.terminate();
      workerRef.current = null;
      workerReadyRef.current = false;
      nativeDetectorRef.current = null;
      useNativeRef.current = false;
      readyRef.current = false;
      setReady(false);
    };
  }, [enabled, postDecoded, postToWorker, trySetReady]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    void navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false,
      })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());

          return;
        }

        streamRef.current = stream;
        const track = stream.getVideoTracks()[0] ?? null;

        if (track) {
          await applyCameraEnhancements(track);
        }

        setVideoTrack(track);

        const video = videoRef.current;

        if (video) {
          video.srcObject = stream;
          await video.play();
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
      lastPostedTokenRef.current = "";
    } else if (ready) {
      postToWorker({ type: "resume" });
      lastPostedTokenRef.current = "";
    }
  }, [paused, ready, postToWorker]);

  return {
    videoRef,
    videoTrack,
    ready,
    cameraError,
  };
}
