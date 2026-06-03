import type { ReaderOptions } from "zxing-wasm/reader";

export type FrameBuffer = {
  rgba: Uint8ClampedArray;
  frame: ImageData;
  width: number;
  height: number;
};

export function createFrameBuffer(width: number, height: number): FrameBuffer {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const frame = {
    data: rgba,
    width,
    height,
  } as ImageData;

  return { rgba, frame, width, height };
}

/** Copy canvas pixels into the preallocated RGBA buffer (one short-lived ImageData from canvas). */
export function copyFrameFromContext(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  buffer: FrameBuffer,
): void {
  const snap = ctx.getImageData(0, 0, buffer.width, buffer.height);

  buffer.rgba.set(snap.data);
}

export function createReaderOptions(): ReaderOptions {
  return {
    formats: ["QRCode"],
    maxNumberOfSymbols: 1,
    tryHarder: false,
  };
}

export type CropRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

/** Center-crop source dimensions to target aspect ratio. */
export function computeCenterCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): CropRect {
  const targetAspect = targetWidth / targetHeight;
  const sourceAspect = sourceWidth / sourceHeight;
  let sw = sourceWidth;
  let sh = sourceHeight;
  let sx = 0;
  let sy = 0;

  if (sourceAspect > targetAspect) {
    sw = Math.floor(sourceHeight * targetAspect);
    sx = Math.floor((sourceWidth - sw) / 2);
  } else if (sourceAspect < targetAspect) {
    sh = Math.floor(sourceWidth / targetAspect);
    sy = Math.floor((sourceHeight - sh) / 2);
  }

  return { sx, sy, sw, sh };
}
