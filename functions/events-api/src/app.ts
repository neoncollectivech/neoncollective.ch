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
import { isAdminAuthDisabled } from "./helpers/admin-auth-dev";
import { createAppRouter } from "./routes";
import { fetchSumUpApiKeyMerchantCode } from "./helpers/sumup";
import { isSumUpConfigured, sumUpMerchantCode } from "./config/sumup";

const log = createLogger("http");

const env = getEventsApiEnv();
if (isAdminAuthDisabled()) {
  log.warn("ADMIN_AUTH_DISABLED=1 — admin routes accept unauthenticated requests (dev only)");
}
if (isSumUpConfigured()) {
  void (async () => {
    const keyMerchant = await fetchSumUpApiKeyMerchantCode();
    const configured = sumUpMerchantCode();
    if (keyMerchant && configured !== keyMerchant) {
      log.info(
        { keyMerchant, configuredMerchant: configured },
        "SumUp sandbox: /me merchant differs from SUMUP_MERCHANT_CODE (expected for sandbox keys created under Developer Settings)",
      );
    }
  })();
}
const auth = createAuth(env);
configureAuth(auth);

const app = authFactory.createApp();

app.use("*", createCorsFromEnv("credentials"));
app.use("*", createHttpRequestLogger(log));
app.onError(createHttpJsonErrorHandler(log));

mountBetterAuth(app, auth);
app.route("/", createAppRouter());

export default app;
