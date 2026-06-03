import type {
  ScannerControlMessage,
  ScannerFrameMessage,
  ScannerInitMessage,
  ScannerWorkerInMessage,
  ScannerWorkerOutMessage,
} from "./scanner-protocol";

import { readBarcodes } from "zxing-wasm/reader";

import {
  computeCenterCrop,
  copyFrameFromContext,
  createFrameBuffer,
  createReaderOptions,
  type FrameBuffer,
} from "./frame-pipeline";
import { initZxingReader } from "./zxing-init";
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let frameBuffer: FrameBuffer | null = null;
const readerOptions = createReaderOptions();
let decoding = false;
let paused = false;
let running = false;
let lastPostedToken = "";
let crop = { sx: 0, sy: 0, sw: 0, sh: 0 };

const post = (message: ScannerWorkerOutMessage) => {
  self.postMessage(message);
};

function ensureCanvas(width: number, height: number): void {
  if (!canvas || canvas.width !== width || canvas.height !== height) {
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    frameBuffer = createFrameBuffer(width, height);
  }
}

function handleResize(width: number, height: number): void {
  ensureCanvas(width, height);
}

async function handleInit(msg: ScannerInitMessage): Promise<void> {
  ensureCanvas(msg.width, msg.height);
  await initZxingReader(msg.wasmBaseUrl);
  post({ type: "ready" });
}

function drawAndDecode(bitmap: ImageBitmap): void {
  if (!ctx || !frameBuffer || decoding || paused || !running) {
    bitmap.close();

    return;
  }

  decoding = true;

  const bw = bitmap.width;
  const bh = bitmap.height;

  if (crop.sw !== bw || crop.sh !== bh) {
    crop = computeCenterCrop(bw, bh, frameBuffer.width, frameBuffer.height);
  }

  ctx.drawImage(
    bitmap,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    frameBuffer.width,
    frameBuffer.height,
  );
  bitmap.close();

  copyFrameFromContext(ctx, frameBuffer);

  readBarcodes(frameBuffer.frame, readerOptions)
    .then((results) => {
      decoding = false;

      if (!results.length) {
        return;
      }

      const text = results[0]?.text?.trim() ?? "";

      if (!text || text === lastPostedToken) {
        return;
      }

      lastPostedToken = text;
      post({ type: "decoded", text });
    })
    .catch((err: unknown) => {
      decoding = false;
      const message = err instanceof Error ? err.message : "Decode failed";

      post({ type: "error", message });
    });
}

function handleControl(msg: ScannerControlMessage): void {
  if (msg.type === "start") {
    running = true;
    paused = false;
    lastPostedToken = "";

    return;
  }

  if (msg.type === "stop") {
    running = false;
    paused = false;
    lastPostedToken = "";

    return;
  }

  if (msg.type === "pause") {
    paused = true;

    return;
  }

  if (msg.type === "resume") {
    paused = false;
    lastPostedToken = "";

    return;
  }

  if (msg.type === "resize") {
    handleResize(msg.width, msg.height);
  }
}

function handleFrame(msg: ScannerFrameMessage): void {
  drawAndDecode(msg.bitmap);
}

self.onmessage = (event: MessageEvent<ScannerWorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === "init") {
    void handleInit(msg);

    return;
  }

  if (msg.type === "frame") {
    handleFrame(msg);

    return;
  }

  handleControl(msg);
};
