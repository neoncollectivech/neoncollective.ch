/**
 * Local development server for events-api.
 * Run: pnpm --filter @neon/events-api dev
 */
import { serveDevApp } from "@neon/server-kit";

import app from "./app";

serveDevApp({
  app,
  defaultPort: 8082,
  readyMessage: (port) => `Events API dev server at http://localhost:${port}`,
});
