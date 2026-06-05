/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_EVENTS_API_URL: string;
  readonly VITE_ADMIN_AUTH_DISABLED?: string;
  readonly VITE_ADMIN_AUTH_DEV_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
