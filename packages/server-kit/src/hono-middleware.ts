import type { ErrorHandler, MiddlewareHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Logger } from "pino";

/** Request timing + structured log line (method, path, status, duration). */
export function createHttpRequestLogger(log: Logger): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    log.info(
      { method: c.req.method, path: c.req.path, status: c.res.status, ms },
      `${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`,
    );
  };
}

/** Logs the error and returns `{ error: message }` JSON with inferred status. */
export function createHttpJsonErrorHandler(log: Logger): ErrorHandler {
  return (err, c) => {
    log.error({ err, path: c.req.path, method: c.req.method }, err.message);
    const status = ("statusCode" in err ? err.statusCode : 500) as ContentfulStatusCode;
    return c.json({ error: err.message || "Internal server error" }, status);
  };
}
