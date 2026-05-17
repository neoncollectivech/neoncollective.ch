import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** GitHub Pages: `VITE_ADMIN_BASE=/admin/` — local dev defaults to `/`. */
const adminBase = process.env.VITE_ADMIN_BASE ?? "/";

export default defineConfig({
  base: adminBase,
  plugins: [react(), tailwindcss()],
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
