export type EnvSource = Record<string, string | undefined>;

function trim(source: EnvSource, key: string): string | undefined {
  const v = source[key]?.trim();
  return v && v.length > 0 ? v : undefined;
}

export type StripeApiEnv = {
  stripeSecretKey: string | undefined;
  allowedOrigin: string | undefined;
  publicSiteUrl: string;
  resendApiKey: string | undefined;
  fromEmail: string | undefined;
  fromName: string | undefined;
  magicLinkSecret: string | undefined;
  apiBaseUrl: string | undefined;
};

export function readStripeApiEnv(source: EnvSource = process.env): StripeApiEnv {
  return {
    stripeSecretKey: trim(source, "STRIPE_SECRET_KEY"),
    allowedOrigin: trim(source, "ALLOWED_ORIGIN"),
    publicSiteUrl: trim(source, "PUBLIC_SITE_URL") ?? "http://localhost:3000",
    resendApiKey: trim(source, "RESEND_API_KEY"),
    fromEmail: trim(source, "FROM_EMAIL"),
    fromName: trim(source, "FROM_NAME"),
    magicLinkSecret: trim(source, "MAGIC_LINK_SECRET"),
    apiBaseUrl: trim(source, "API_BASE_URL"),
  };
}

let cachedEnv: StripeApiEnv | null = null;

export function getStripeApiEnv(): StripeApiEnv {
  if (!cachedEnv) {
    cachedEnv = readStripeApiEnv();
  }
  return cachedEnv;
}

/** Test-only: reset cached env (optionally from explicit source). */
export function resetStripeApiEnvForTests(source?: EnvSource): void {
  cachedEnv = source ? readStripeApiEnv(source) : null;
}
