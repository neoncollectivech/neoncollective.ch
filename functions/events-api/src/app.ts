import {
  createCorsFromEnv,
  createHttpJsonErrorHandler,
  createHttpRequestLogger,
  createLogger,
} from "@neon/server-kit";

import { configureAuth, createAuth } from "./auth/auth";
import { authFactory } from "./auth/factory";
import { mountBetterAuth } from "./auth/mount";
import { getEventsApiEnv } from "./config/runtime-env";
import { createAppRouter } from "./routes";

const log = createLogger("http");

const env = getEventsApiEnv();
const auth = createAuth(env);
configureAuth(auth);

const app = authFactory.createApp();

app.use("*", createCorsFromEnv("credentials"));
app.use("*", createHttpRequestLogger(log));
app.onError(createHttpJsonErrorHandler(log));

mountBetterAuth(app, auth);
app.route("/", createAppRouter());

export default app;
