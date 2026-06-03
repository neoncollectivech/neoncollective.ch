export type ScannerInitMessage = {
  type: "init";
  wasmBaseUrl: string;
  width: number;
  height: number;
};

export type ScannerFrameMessage = {
  type: "frame";
  bitmap: ImageBitmap;
};

export type ScannerControlMessage =
  | { type: "start" }
  | { type: "stop" }
  | { type: "pause" }
  | { type: "resume" };

export type ScannerWorkerInMessage =
  | ScannerInitMessage
  | ScannerFrameMessage
  | ScannerControlMessage;

export type ScannerDecodedMessage = {
  type: "decoded";
  text: string;
};

export type ScannerReadyMessage = {
  type: "ready";
};

export type ScannerErrorMessage = {
  type: "error";
  message: string;
};

export type ScannerWorkerOutMessage =
  | ScannerDecodedMessage
  | ScannerReadyMessage
  | ScannerErrorMessage;

/** Center square ROI decode resolution (ZXing fallback). */
export const SCAN_WIDTH_DEFAULT = 720;
export const SCAN_HEIGHT_DEFAULT = 720;
