import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/** GitHub Pages: `VITE_ADMIN_BASE=/admin/` — local dev defaults to `/`. */
const adminBase = process.env.VITE_ADMIN_BASE ?? "/";

/** Absolute path from site root for manifest `start_url` / `scope` / `id`. */
function pwaScopePath(base: string): string {
  if (base === "/") {
    return "/";
  }

  return base.endsWith("/") ? base : `${base}/`;
}

const pwaScope = pwaScopePath(adminBase);

const pwaIncludeAssets = [
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
  "android-chrome-192x192.png",
  "android-chrome-512x512.png",
];

export default defineConfig({
  base: adminBase,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: pwaIncludeAssets,
      manifest: {
        id: pwaScope,
        name: "NEON Admin",
        short_name: "NEON Admin",
        description: "NEON Collective staff admin portal",
        theme_color: "#050505",
        background_color: "#050505",
        display: "standalone",
        start_url: pwaScope,
        scope: pwaScope,
        icons: [
          {
            src: "android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "index.html",
        // Admin bundle is ~2.1 MiB minified; default Workbox precache cap is 2 MiB.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      // Set devOptions.enabled: true locally to debug the service worker.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8082",
        changeOrigin: true,
      },
      "/admin": {
        target: "http://localhost:8082",
        changeOrigin: true,
      },
    },
  },
});
