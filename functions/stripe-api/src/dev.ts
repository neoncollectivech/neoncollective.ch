/**
 * Local development server using Hono's Node.js adapter.
 * Run with: pnpm --filter @neon/stripe-api dev
 *
 * Bypasses functions-framework for fast hot-reload via tsx watch.
 * Set STRIPE_SECRET_KEY in a .env.local file or export it in your shell.
 */
import { serveDevApp } from "@neon/server-kit";

import app from "./index";

serveDevApp({
  app,
  defaultPort: 8081,
  readyMessage: (port) => `Stripe API dev server running at http://localhost:${port}`,
});
