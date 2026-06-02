export type EnvSource = Record<string, string | undefined>;

function trim(source: EnvSource, key: string): string | undefined {
  const v = source[key]?.trim();
  return v && v.length > 0 ? v : undefined;
}

export type EventsApiEnv = {
  databaseUrl: string | undefined;
  eventsAllowedOrigin: string | undefined;
  allowedOrigin: string | undefined;
  publicSiteUrl: string;
  publicSiteDefaultLocale: string;
  stripeSecretKey: string | undefined;
  stripeWebhookSecret: string | undefined;
  resendApiKey: string | undefined;
  fromEmail: string | undefined;
  fromName: string | undefined;
  participantSessionMaxAgeSec: number;
  eventSessionCrossSite: boolean;
  twilioAccountSid: string | undefined;
  twilioAuthToken: string | undefined;
  twilioApiKeySid: string | undefined;
  twilioApiKeySecret: string | undefined;
  twilioMessagingServiceSid: string | undefined;
  twilioFrom: string | undefined;
  staffCheckinToken: string | undefined;
  eventsApiPublicUrl: string;
  betterAuthSecret: string | undefined;
  googleClientId: string;
  googleClientSecret: string;
  adminAllowedOrigin: string | undefined;
  betterAuthCrossSubdomain: boolean;
  betterAuthCookieDomain: string | undefined;
  nodeEnv: string | undefined;
  e2eTestMode: boolean;
  e2eTestOtp: string | undefined;
  r2AccountId: string | undefined;
  r2AccessKeyId: string | undefined;
  r2SecretAccessKey: string | undefined;
  r2BucketName: string | undefined;
  r2PublicBaseUrl: string | undefined;
};

export function readEventsApiEnv(source: EnvSource = process.env): EventsApiEnv {
  const maxAgeRaw = trim(source, "PARTICIPANT_SESSION_MAX_AGE_SEC");
  const maxAge = maxAgeRaw ? Number.parseInt(maxAgeRaw, 10) : 2_592_000;

  return {
    databaseUrl: trim(source, "DATABASE_URL"),
    eventsAllowedOrigin: trim(source, "EVENTS_ALLOWED_ORIGIN"),
    allowedOrigin: trim(source, "ALLOWED_ORIGIN"),
    publicSiteUrl: trim(source, "PUBLIC_SITE_URL") ?? "http://localhost:3000",
    publicSiteDefaultLocale: trim(source, "PUBLIC_SITE_DEFAULT_LOCALE") ?? "en",
    stripeSecretKey: trim(source, "STRIPE_SECRET_KEY"),
    stripeWebhookSecret: trim(source, "STRIPE_WEBHOOK_SECRET"),
    resendApiKey: trim(source, "RESEND_API_KEY"),
    fromEmail: trim(source, "FROM_EMAIL"),
    fromName: trim(source, "FROM_NAME"),
    participantSessionMaxAgeSec: Number.isFinite(maxAge) ? maxAge : 2_592_000,
    eventSessionCrossSite: trim(source, "EVENT_SESSION_CROSS_SITE") !== "0",
    twilioAccountSid: trim(source, "TWILIO_ACCOUNT_SID"),
    twilioAuthToken: trim(source, "TWILIO_AUTH_TOKEN"),
    twilioApiKeySid: trim(source, "TWILIO_API_KEY_SID"),
    twilioApiKeySecret: trim(source, "TWILIO_API_KEY_SECRET"),
    twilioMessagingServiceSid: trim(source, "TWILIO_MESSAGING_SERVICE_SID"),
    twilioFrom: trim(source, "TWILIO_FROM"),
    staffCheckinToken: trim(source, "STAFF_CHECKIN_TOKEN"),
    eventsApiPublicUrl: trim(source, "EVENTS_API_PUBLIC_URL") ?? "http://localhost:8082",
    betterAuthSecret: trim(source, "BETTER_AUTH_SECRET"),
    googleClientId: trim(source, "GOOGLE_CLIENT_ID") ?? "",
    googleClientSecret: trim(source, "GOOGLE_CLIENT_SECRET") ?? "",
    adminAllowedOrigin: trim(source, "ADMIN_ALLOWED_ORIGIN"),
    betterAuthCrossSubdomain: trim(source, "BETTER_AUTH_CROSS_SUBDOMAIN") === "1",
    betterAuthCookieDomain: trim(source, "BETTER_AUTH_COOKIE_DOMAIN"),
    nodeEnv: trim(source, "NODE_ENV"),
    e2eTestMode:
      trim(source, "NODE_ENV") !== "production" && trim(source, "E2E_TEST_MODE") === "1",
    e2eTestOtp: trim(source, "E2E_TEST_OTP"),
    r2AccountId: trim(source, "R2_ACCOUNT_ID"),
    r2AccessKeyId: trim(source, "R2_ACCESS_KEY_ID"),
    r2SecretAccessKey: trim(source, "R2_SECRET_ACCESS_KEY"),
    r2BucketName: trim(source, "R2_BUCKET_NAME"),
    r2PublicBaseUrl: trim(source, "R2_PUBLIC_BASE_URL"),
  };
}

let cachedEnv: EventsApiEnv | null = null;

/** Parsed env singleton; defaults to `process.env` on first read. */
export function getEventsApiEnv(): EventsApiEnv {
  if (!cachedEnv) {
    cachedEnv = readEventsApiEnv();
  }
  return cachedEnv;
}
