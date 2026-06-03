/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_EVENTS_API_URL: string;
  readonly VITE_DOOR_BASE?: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __DOOR_BUILD_LABEL__: string;

interface Window {
  BarcodeDetector?: {
    new (options?: { formats: string[] }): BarcodeDetector;
    getSupportedFormats(): Promise<string[]>;
  };
}

/** Chromium / Safari 17+ native QR scanning */
declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  static getSupportedFormats(): Promise<string[]>;
  detect(
    source: ImageBitmapSource,
  ): Promise<{ rawValue: string; format: string }[]>;
}
