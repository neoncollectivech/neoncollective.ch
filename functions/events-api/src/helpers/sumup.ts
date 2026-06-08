import { createHmac, timingSafeEqual } from "node:crypto";

import SumUp from "@sumup/sdk";

import { createLogger } from "@neon/server-kit";

import {
  sumUpAppSwitchAndroidAppId,
  sumUpAppSwitchCallbackBase,
} from "../config/sumup-app-switch";
import {
  isSumUpConfigured,
  isSumUpWebhookVerificationRequired,
  sumUpAffiliateKey,
  sumUpAppId,
  sumUpMerchantCode,
  sumUpWebhookReturnUrl,
  sumUpWebhookSecret,
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

export type SumUpPosConfig = {
  configuredMerchantCode: string;
};

export function getSumUpPosConfig(): SumUpPosConfig {
  return { configuredMerchantCode: sumUpMerchantCode() };
}

export type SumUpReaderPaymentStatus = "pending" | "successful" | "failed" | "unknown";

function mapSumUpSimpleStatus(
  simpleStatus: string | undefined,
): SumUpReaderPaymentStatus {
  const status = simpleStatus?.toUpperCase();
  if (status === "SUCCESSFUL" || status === "PAID_OUT" || status === "PAID") {
    return "successful";
  }
  if (status === "FAILED" || status === "CANCELLED") {
    return "failed";
  }
  return "pending";
}

export async function getSumUpPaymentStatusByClientTransactionId(
  clientTransactionId: string,
): Promise<SumUpReaderPaymentStatus> {
  try {
    const tx = await getSumUpClient().transactions.get(sumUpMerchantCode(), {
      client_transaction_id: clientTransactionId,
    });
    return mapSumUpSimpleStatus(tx.simple_status);
  } catch {
    return "unknown";
  }
}

export async function getSumUpPaymentStatusByForeignTransactionId(
  foreignTransactionId: string,
): Promise<SumUpReaderPaymentStatus> {
  try {
    const tx = await getSumUpClient().transactions.get(sumUpMerchantCode(), {
      foreign_transaction_id: foreignTransactionId,
    });
    return mapSumUpSimpleStatus(tx.simple_status);
  } catch {
    return "unknown";
  }
}

export async function getSumUpPaymentStatusByTransactionCode(
  transactionCode: string,
): Promise<SumUpReaderPaymentStatus> {
  try {
    const tx = await getSumUpClient().transactions.get(sumUpMerchantCode(), {
      transaction_code: transactionCode.trim(),
    });
    return mapSumUpSimpleStatus(tx.simple_status);
  } catch {
    return "unknown";
  }
}

function formatAppSwitchAmount(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

function buildAppSwitchCallbackUrl(orderId: string): string {
  const url = new URL(sumUpAppSwitchCallbackBase());
  url.searchParams.set("sumup", "return");
  url.searchParams.set("orderId", orderId);
  return url.toString();
}

export function buildSumUpAppSwitchUrl(params: {
  orderId: string;
  amountCents: number;
  currency: string;
  title: string;
  platform: "ios" | "android";
  receiptEmail?: string | null;
  receiptPhone?: string | null;
}): string {
  const callback = buildAppSwitchCallbackUrl(params.orderId);
  const amount = formatAppSwitchAmount(params.amountCents);
  const query = new URLSearchParams();

  query.set("affiliate-key", sumUpAffiliateKey());
  query.set("currency", params.currency.toUpperCase());
  query.set("title", params.title);
  query.set("foreign-tx-id", params.orderId);
  query.set("skip-screen-success", "true");

  if (params.platform === "ios") {
    query.set("amount", amount);
    query.set("callbacksuccess", callback);
    query.set("callbackfail", callback);
  } else {
    query.set("total", amount);
    query.set("callback", callback);
    const appId = sumUpAppSwitchAndroidAppId() ?? sumUpAppId();
    query.set("app-id", appId);
  }

  const receiptEmail = params.receiptEmail?.trim();
  if (receiptEmail) {
    query.set("receipt-email", receiptEmail);
  }
  const receiptPhone = params.receiptPhone?.trim();
  if (receiptPhone) {
    query.set("receipt-mobilephone", receiptPhone);
  }

  return `sumupmerchant://pay/1.0?${query.toString()}`;
}

export function verifySumUpWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): boolean {
  const secret = sumUpWebhookSecret();
  if (isSumUpWebhookVerificationRequired()) {
    if (!secret) {
      log.error("SUMUP_WEBHOOK_SECRET is required in production.");
      return false;
    }
  } else if (!secret) {
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
