import * as functions from "@google-cloud/functions-framework";
import { getRequestListener } from "@hono/node-server";
import {
  createCorsFromEnv,
  createHttpJsonErrorHandler,
  createHttpRequestLogger,
  createLogger,
} from "@neon/server-kit";
import { Hono } from "hono";

import { mountBetterAuth } from "./auth/mount";
import { createAppRouter } from "./routes";

const log = createLogger("http");

const app = new Hono();

app.use("*", createCorsFromEnv("credentials"));
app.use("*", createHttpRequestLogger(log));
app.onError(createHttpJsonErrorHandler(log));

mountBetterAuth(app);
app.route("/", createAppRouter());

functions.http("eventsApi", getRequestListener(app.fetch));

export default app;
