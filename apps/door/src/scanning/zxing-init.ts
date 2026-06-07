import {
  prepareZXingModule,
  type PrepareZXingModuleOptions,
} from "zxing-wasm/reader";

let initPromise: Promise<void> | null = null;
let lastBaseUrl = "";

export function getZxingWasmUrl(wasmBaseUrl: string): string {
  const base = wasmBaseUrl.endsWith("/") ? wasmBaseUrl : `${wasmBaseUrl}/`;

  return `${base}zxing_reader.wasm`;
}

export function initZxingReader(wasmBaseUrl: string): Promise<void> {
  const normalizedBase = wasmBaseUrl.endsWith("/")
    ? wasmBaseUrl
    : `${wasmBaseUrl}/`;

  if (initPromise && lastBaseUrl === normalizedBase) {
    return initPromise;
  }

  lastBaseUrl = normalizedBase;
  const wasmUrl = getZxingWasmUrl(normalizedBase);

  const overrides: NonNullable<PrepareZXingModuleOptions["overrides"]> = {
    locateFile: (path: string) => {
      if (path.endsWith(".wasm")) {
        return wasmUrl;
      }

      return path;
    },
  };

  initPromise = prepareZXingModule({
    overrides,
    fireImmediately: true,
  }).then(() => undefined);

  return initPromise;
}
