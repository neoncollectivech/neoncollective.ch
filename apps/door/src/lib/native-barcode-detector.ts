function barcodeDetectorCtor(): typeof BarcodeDetector | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return "BarcodeDetector" in window
    ? (window as Window & { BarcodeDetector: typeof BarcodeDetector })
        .BarcodeDetector
    : undefined;
}

/** Native QR path (Chrome / Safari 17+) — much faster than ZXing WASM. */
export async function createNativeQrDetector(): Promise<BarcodeDetector | null> {
  const BarcodeDetectorClass = barcodeDetectorCtor();

  if (!BarcodeDetectorClass) {
    return null;
  }

  try {
    const supported = await BarcodeDetectorClass.getSupportedFormats();

    if (!supported.includes("qr_code")) {
      return null;
    }

    return new BarcodeDetectorClass({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

export async function detectQrFromVideo(
  detector: BarcodeDetector,
  video: HTMLVideoElement,
): Promise<string | null> {
  const codes = await detector.detect(video);
  const text = codes[0]?.rawValue?.trim() ?? "";

  return text || null;
}
