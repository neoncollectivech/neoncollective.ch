import { createHmac, timingSafeEqual } from "node:crypto";

import SumUp from "@sumup/sdk";

import { createLogger } from "@neon/server-kit";

import {
  isSumUpConfigured,
  sumUpAffiliateKey,
  sumUpAppId,
  sumUpMerchantCode,
  sumUpWebhookReturnUrl,
} from "../config/sumup";

const log = createLogger("sumup");

let client: SumUp | null = null;

export type SumUpCheckoutErrorCode = "reader_offline" | "unknown";

export class SumUpCheckoutError extends Error {
  readonly code: SumUpCheckoutErrorCode;
  readonly detail: string | undefined;

  constructor(message: string, code: SumUpCheckoutErrorCode, detail?: string) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

function parseSumUpApiError(error: unknown): { title?: string; detail?: string } {
  if (!error || typeof error !== "object") {
    return {};
  }
  const nested = (error as { error?: { title?: string; detail?: string } }).error;
  if (nested && typeof nested === "object") {
    return nested;
  }
  if ("detail" in error || "title" in error) {
    return error as { title?: string; detail?: string };
  }
  return {};
}

function toCheckoutError(error: unknown): SumUpCheckoutError {
  const parsed = parseSumUpApiError(error);
  const detail = parsed.detail?.trim();
  const title = parsed.title?.trim();
  const combined = `${title ?? ""} ${detail ?? ""}`.toLowerCase();

  if (combined.includes("offline") || title === "Reader Offline") {
    return new SumUpCheckoutError(
      "The Solo reader is offline. Open Virtual Solo or power on your terminal.",
      "reader_offline",
      detail ?? title,
    );
  }

  return new SumUpCheckoutError(
    detail ?? title ?? "SumUp reader checkout failed.",
    "unknown",
    detail ?? title,
  );
}

function getSumUpClient(): SumUp {
  if (!isSumUpConfigured()) {
    throw new Error("SumUp is not configured.");
  }
  if (!client) {
    client = new SumUp({ apiKey: process.env.SUMUP_API_KEY!.trim() });
  }
  return client;
}

export type SumUpReaderSummary = {
  id: string;
  name: string;
  status: string | null;
  deviceIdentifier: string | null;
  /** Last known Cloud API connection status, e.g. ONLINE or OFFLINE. */
  connectionStatus: string | null;
  online: boolean;
};

export async function listSumUpReaders(): Promise<SumUpReaderSummary[]> {
  const merchantCode = sumUpMerchantCode();
  const response = await getSumUpClient().readers.list(merchantCode);
  const items = response.items ?? [];

  return Promise.all(
    items.map(async (reader) => {
      const id = reader.id ?? "";
      let connectionStatus: string | null = null;
      if (id) {
        try {
          const statusResponse = await getSumUpClient().readers.getStatus(merchantCode, id);
          connectionStatus = statusResponse.data?.status ?? null;
        } catch (e) {
          log.warn({ readerId: id, err: e }, "Failed to fetch SumUp reader status");
        }
      }

      return {
        id,
        name: reader.name ?? "Reader",
        status: reader.status ?? null,
        deviceIdentifier: reader.device?.identifier ?? null,
        connectionStatus,
        online: connectionStatus === "ONLINE",
      };
    }),
  );
}

export async function createSumUpReaderCheckout(params: {
  readerId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  description: string;
}): Promise<string> {
  const minorUnit = 2;
  const returnUrl = sumUpWebhookReturnUrl();
  const body: Parameters<SumUp["readers"]["createCheckout"]>[2] = {
    total_amount: {
      currency: params.currency.toUpperCase(),
      minor_unit: minorUnit,
      value: params.amountCents,
    },
    description: params.description,
    affiliate: {
      app_id: sumUpAppId(),
      foreign_transaction_id: params.orderId,
      key: sumUpAffiliateKey(),
    },
  };
  if (returnUrl) {
    body.return_url = returnUrl;
  }

  try {
    const response = await getSumUpClient().readers.createCheckout(
      sumUpMerchantCode(),
      params.readerId,
      body,
    );
    const clientTransactionId = response.data?.client_transaction_id?.trim();
    if (!clientTransactionId) {
      throw new SumUpCheckoutError(
        "SumUp reader checkout did not return a client transaction id.",
        "unknown",
      );
    }
    return clientTransactionId;
  } catch (error) {
    if (error instanceof SumUpCheckoutError) {
      throw error;
    }
    const mapped = toCheckoutError(error);
    log.warn(
      { readerId: params.readerId, orderId: params.orderId, detail: mapped.detail },
      "SumUp reader checkout failed",
    );
    throw mapped;
  }
}

export async function terminateSumUpReaderCheckout(readerId: string): Promise<void> {
  await getSumUpClient().readers.terminateCheckout(sumUpMerchantCode(), readerId);
}

export type SumUpPairedReader = {
  id: string;
  name: string;
  status: string | null;
  deviceIdentifier: string | null;
};

export async function pairSumUpReader(params: {
  pairingCode: string;
  name: string;
}): Promise<SumUpPairedReader> {
  const reader = await getSumUpClient().readers.create(sumUpMerchantCode(), {
    pairing_code: params.pairingCode.trim(),
    name: params.name.trim(),
  });
  if (!reader?.id) {
    throw new Error("SumUp did not return a reader id after pairing.");
  }
  return {
    id: reader.id,
    name: reader.name ?? params.name.trim(),
    status: reader.status ?? null,
    deviceIdentifier: reader.device?.identifier ?? null,
  };
}

export async function deleteSumUpReader(readerId: string): Promise<void> {
  await getSumUpClient().readers.delete(sumUpMerchantCode(), readerId);
}

/** Merchant code for the authenticated API key (`GET /v0.1/me`). */
export async function fetchSumUpApiKeyMerchantCode(): Promise<string | null> {
  const apiKey = process.env.SUMUP_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  const response = await fetch("https://api.sumup.com/v0.1/me", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    return null;
  }
  const body = (await response.json()) as { merchant_profile?: { merchant_code?: string } };
  return body.merchant_profile?.merchant_code?.trim() ?? null;
}

export type SumUpCredentialsDiagnostic = {
  configuredMerchantCode: string;
  /** Merchant from `GET /v0.1/me` — often the live profile even when using a sandbox key. */
  apiKeyMerchantCode: string | null;
  /**
   * True only when /me merchant equals SUMUP_MERCHANT_CODE.
   * False for typical sandbox setups (expected — readers use configuredMerchantCode in API paths).
   */
  credentialsAligned: boolean;
  note: string | null;
};

export async function resolveSumUpCredentialsDiagnostic(): Promise<SumUpCredentialsDiagnostic> {
  const configuredMerchantCode = sumUpMerchantCode();
  const apiKeyMerchantCode = await fetchSumUpApiKeyMerchantCode();
  const credentialsAligned = Boolean(
    apiKeyMerchantCode && apiKeyMerchantCode === configuredMerchantCode,
  );
  const note =
    apiKeyMerchantCode && !credentialsAligned
      ? "SumUp /me shows your live merchant profile; sandbox readers on SUMUP_MERCHANT_CODE are normal. ONLINE/OFFLINE comes from GET .../readers/{id}/status, not /me."
      : null;
  return {
    configuredMerchantCode,
    apiKeyMerchantCode,
    credentialsAligned,
    note,
  };
}

export type SumUpReaderPaymentStatus = "pending" | "successful" | "failed" | "unknown";

export async function getSumUpPaymentStatusByClientTransactionId(
  clientTransactionId: string,
): Promise<SumUpReaderPaymentStatus> {
  try {
    const tx = await getSumUpClient().transactions.get(sumUpMerchantCode(), {
      client_transaction_id: clientTransactionId,
    });
    const status = tx.simple_status?.toUpperCase();
    if (status === "SUCCESSFUL" || status === "PAID_OUT" || status === "PAID") {
      return "successful";
    }
    if (status === "FAILED" || status === "CANCELLED") {
      return "failed";
    }
    return "pending";
  } catch {
    return "unknown";
  }
}

export function verifySumUpWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): boolean {
  const secret = process.env.SUMUP_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return true;
  }
  if (!signatureHeader?.trim()) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.trim();
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}
