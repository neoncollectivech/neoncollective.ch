import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { viteStaticCopy } from "vite-plugin-static-copy";

/** GitHub Pages / CDN: `VITE_DOOR_BASE=/door/` — local dev defaults to `/`. */
function resolveDoorBase(env: Record<string, string>): string {
  return process.env.VITE_DOOR_BASE ?? env.VITE_DOOR_BASE ?? "/";
}

function pwaScopePath(base: string): string {
  if (base === "/") {
    return "/";
  }

  return base.endsWith("/") ? base : `${base}/`;
}

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
  "zxing_reader.wasm",
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const doorBase = resolveDoorBase(env);
  const pwaScope = pwaScopePath(doorBase);
  /** Path-only manifest fields — iOS rejects cross-origin or absolute id/start_url mismatches. */
  const manifestStartUrl = pwaScope;
  const manifestId = pwaScope;

  return {
    base: doorBase,
    define: {
      __DOOR_BUILD_LABEL__: JSON.stringify(
        process.env.VITE_DOOR_BUILD_LABEL ??
          env.VITE_DOOR_BUILD_LABEL ??
          new Date().toISOString().slice(0, 10),
      ),
    },
    plugins: [
      react(),
      tailwindcss(),
      viteStaticCopy({
        targets: [
          {
            src: "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm",
            dest: ".",
          },
        ],
      }),
      VitePWA({
        registerType: "prompt",
        injectRegister: false,
        scope: doorBase,
        includeAssets: pwaIncludeAssets,
        manifest: {
          id: manifestId,
          name: "NEON Door",
          short_name: "NEON Door",
          description: "NEON Collective event check-in scanner",
          theme_color: "#050505",
          background_color: "#050505",
          display: "standalone",
          prefer_related_applications: false,
          start_url: manifestStartUrl,
          scope: pwaScope,
          icons: [
            {
              src: pwaPublicAssetPath(doorBase, "apple-touch-icon.png"),
              sizes: "180x180",
              type: "image/png",
              purpose: "any",
            },
            {
              src: pwaPublicAssetPath(doorBase, "android-chrome-192x192.png"),
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: pwaPublicAssetPath(doorBase, "android-chrome-512x512.png"),
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: pwaPublicAssetPath(doorBase, "android-chrome-512x512.png"),
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,wasm}"],
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/check-in/, /^\/events\//],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.endsWith("/check-in"),
              handler: "NetworkFirst",
              method: "POST",
              options: {
                cacheName: "door-check-in",
                networkTimeoutSeconds: 4,
              },
            },
            {
              urlPattern: ({ url }) =>
                /\/events\/[^/]+\/admissions/.test(url.pathname),
              handler: "NetworkFirst",
              options: {
                cacheName: "door-admissions",
                networkTimeoutSeconds: 10,
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    worker: {
      format: "es",
    },
    server: {
      host: true,
      port: 5174,
      proxy: {
        "/check-in": {
          target: "http://localhost:8082",
          changeOrigin: true,
        },
        "/events": {
          target: "http://localhost:8082",
          changeOrigin: true,
        },
        "/admission": {
          target: "http://localhost:8082",
          changeOrigin: true,
        },
      },
    },
  };
});
