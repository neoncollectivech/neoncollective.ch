import { createHmac, timingSafeEqual } from "node:crypto";

import SumUp from "@sumup/sdk";

import {
  isSumUpConfigured,
  sumUpAffiliateKey,
  sumUpAppId,
  sumUpMerchantCode,
  sumUpWebhookReturnUrl,
} from "../config/sumup";

let client: SumUp | null = null;

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
};

export async function listSumUpReaders(): Promise<SumUpReaderSummary[]> {
  const response = await getSumUpClient().readers.list(sumUpMerchantCode());
  return (response.items ?? []).map((reader) => ({
    id: reader.id ?? "",
    name: reader.name ?? "Reader",
    status: reader.status ?? null,
  }));
}

export async function createSumUpReaderCheckout(params: {
  readerId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  description: string;
}): Promise<string> {
  const minorUnit = 2;
  const response = await getSumUpClient().readers.createCheckout(
    sumUpMerchantCode(),
    params.readerId,
    {
      total_amount: {
        currency: params.currency.toUpperCase(),
        minor_unit: minorUnit,
        value: params.amountCents,
      },
      description: params.description,
      return_url: sumUpWebhookReturnUrl(),
      affiliate: {
        app_id: sumUpAppId(),
        foreign_transaction_id: params.orderId,
        key: sumUpAffiliateKey(),
      },
    },
  );
  const clientTransactionId = response.data?.client_transaction_id?.trim();
  if (!clientTransactionId) {
    throw new Error("SumUp reader checkout did not return a client transaction id.");
  }
  return clientTransactionId;
}

export async function terminateSumUpReaderCheckout(readerId: string): Promise<void> {
  await getSumUpClient().readers.terminateCheckout(sumUpMerchantCode(), readerId);
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
    if (status === "SUCCESSFUL" || status === "PAID") {
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
