import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/** GitHub Pages: `VITE_ADMIN_BASE=/admin/` — local dev defaults to `/`. */
function resolveAdminBase(env: Record<string, string>): string {
  return process.env.VITE_ADMIN_BASE ?? env.VITE_ADMIN_BASE ?? "/";
}

/** Absolute path from site root for manifest `start_url` / `scope` / `id`. */
function pwaScopePath(base: string): string {
  if (base === "/") {
    return "/";
  }

  return base.endsWith("/") ? base : `${base}/`;
}

/** Root-absolute public asset path (e.g. `/admin/android-chrome-192x192.png`). */
function pwaPublicAssetPath(base: string, file: string): string {
  if (base === "/") {
    return `/${file}`;
  }

  const prefix = base.endsWith("/") ? base : `${base}/`;

  return `${prefix}${file}`;
}

const pwaIncludeAssets = [
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
  "android-chrome-192x192.png",
  "android-chrome-512x512.png",
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const adminBase = resolveAdminBase(env);
  const pwaScope = pwaScopePath(adminBase);
  const publicSiteUrl = (
    process.env.VITE_PUBLIC_SITE_URL ?? env.VITE_PUBLIC_SITE_URL
  )?.replace(/\/$/, "");
  const manifestStartUrl =
    publicSiteUrl && adminBase !== "/"
      ? `${publicSiteUrl}${pwaScope}`
      : pwaScope;

  return {
    base: adminBase,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        // Immediate registration in index.html (plugin injectRegister waits for `load`).
        injectRegister: false,
        scope: adminBase,
        includeAssets: pwaIncludeAssets,
        manifest: {
          id: manifestStartUrl,
          name: "NEON Admin",
          short_name: "NEON Admin",
          description: "NEON Collective staff admin portal",
          theme_color: "#050505",
          background_color: "#050505",
          display: "standalone",
          prefer_related_applications: false,
          start_url: manifestStartUrl,
          scope: pwaScope,
          icons: [
            {
              src: pwaPublicAssetPath(adminBase, "android-chrome-192x192.png"),
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: pwaPublicAssetPath(adminBase, "android-chrome-512x512.png"),
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: pwaPublicAssetPath(adminBase, "android-chrome-512x512.png"),
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/admin\/auth/, /^\/api\//],
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
  };
});
