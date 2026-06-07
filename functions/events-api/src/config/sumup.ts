export function isSumUpConfigured(): boolean {
  return Boolean(
    process.env.SUMUP_API_KEY?.trim() &&
      process.env.SUMUP_MERCHANT_CODE?.trim() &&
      process.env.SUMUP_AFFILIATE_KEY?.trim() &&
      process.env.SUMUP_APP_ID?.trim(),
  );
}

export function sumUpMerchantCode(): string {
  const code = process.env.SUMUP_MERCHANT_CODE?.trim();
  if (!code) {
    throw new Error("SUMUP_MERCHANT_CODE is not configured.");
  }
  return code;
}

export function sumUpAffiliateKey(): string {
  const key = process.env.SUMUP_AFFILIATE_KEY?.trim();
  if (!key) {
    throw new Error("SUMUP_AFFILIATE_KEY is not configured.");
  }
  return key;
}

export function sumUpAppId(): string {
  const id = process.env.SUMUP_APP_ID?.trim();
  if (!id) {
    throw new Error("SUMUP_APP_ID is not configured.");
  }
  return id;
}

export function sumUpWebhookReturnUrl(): string | undefined {
  const base = process.env.EVENTS_API_PUBLIC_URL?.trim();
  if (!base) {
    return undefined;
  }
  const url = `${base.replace(/\/$/, "")}/pos/webhooks/sumup`;
  if (!url.startsWith("https://")) {
    return undefined;
  }
  try {
    const { hostname } = new URL(url);
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local")
    ) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  return url;
}

export function sumUpWebhookSecret(): string | undefined {
  const secret = process.env.SUMUP_WEBHOOK_SECRET?.trim();
  return secret || undefined;
}

/** SumUp recommends verifying `x-payload-signature` in production. */
export function isSumUpWebhookVerificationRequired(): boolean {
  return process.env.NODE_ENV === "production";
}
