import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(rootDir, "..");

dotenv.config({ path: path.join(repoRoot, "functions/events-api/.env.local") });
dotenv.config({ path: path.join(repoRoot, "apps/web/.env.local") });

/** UI mode: start `pnpm dev:e2e` yourself — turbo blocks the UI on "Loading…". */
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1";

/** Same ports as `pnpm dev` (@neon/web :3000, @neon/events-api :8082). */
const webServers = skipWebServer
  ? undefined
  : [
      {
        command: "pnpm --filter @neon/events-api dev",
        url: "http://127.0.0.1:8082/health",
        cwd: repoRoot,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        env: { ...process.env, E2E_TEST_MODE: "1" },
      },
      {
        command: "pnpm --filter @neon/web dev",
        url: "http://127.0.0.1:3000",
        cwd: repoRoot,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
    ];

export default defineConfig({
  testDir: path.join(rootDir, "web"),
  testMatch: "**/*.spec.mjs",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  globalSetup: path.join(rootDir, "global-setup.mjs"),
  webServer: webServers,
});
