import { serve } from "@hono/node-server";
import type { Hono } from "hono";

import { createLogger } from "./logger.js";

export function serveDevApp(options: {
  app: Hono;
  defaultPort: number;
  /** Logger child name (default `"dev"`). */
  loggerModule?: string;
  /** Message template; receives the bound port. */
  readyMessage: (port: number) => string;
}): void {
  const log = createLogger(options.loggerModule ?? "dev");
  const port = parseInt(process.env.PORT || String(options.defaultPort), 10);
  const server = serve({ fetch: options.app.fetch, port }, (info) => {
    log.info({ port: info.port }, options.readyMessage(info.port));
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      log.error(
        { port, err },
        `Port ${port} is already in use. Stop the other process or set PORT to a free port.`,
      );
      process.exit(1);
    }
    throw err;
  });
}
