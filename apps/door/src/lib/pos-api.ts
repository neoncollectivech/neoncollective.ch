import { api } from "@/lib/api-client";

export type PosReader = {
  id: string;
  name: string;
  status: string | null;
  deviceIdentifier: string | null;
  connectionStatus: string | null;
  online: boolean;
};

export type PosTier = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  placesRemaining: number | null;
  active: boolean;
  sortOrder: number;
  selectionMode: "exclusive" | "addon";
};

export type PosCatalog = {
  eventId: string;
  title: string;
  slug: string;
  tiers: PosTier[];
};

export type PosRegisteredTier = {
  id: string;
  name: string;
  description: string;
  selectionMode: "exclusive" | "addon";
  priceCents: number;
  currency: string;
};

export type PosResolvedGuest = {
  personId: string;
  guestName: string;
  registeredTiers: PosRegisteredTier[];
  availableUpsellTiers: PosTier[];
  hasPaidExclusive: boolean;
};

export type PosPricingPreview = {
  amountCents: number;
  subtotalCents: number;
  discountCents: number;
  currency: string;
};

export type PosSaleCreateResult = {
  orderId: string;
  amountCents: number;
  readerId: string;
  paymentStatus: "pending" | "paid";
  requiresPayment: boolean;
};

export type PosSaleStatus = {
  orderId: string;
  status: "pending" | "paid" | "failed" | "refunded";
  paymentStatus: "pending" | "successful" | "failed" | "unknown";
  amountCents: number;
  guestName: string | null;
  tiers: string | null;
  signedCredential: string | null;
};

export type SumUpPosConfig = {
  configuredMerchantCode: string;
};

export type PosReadersResponse = {
  readers: PosReader[];
  sumup: SumUpPosConfig;
};

export async function listPosReaders(): Promise<PosReadersResponse> {
  const { data } = await api.get<PosReadersResponse>("/pos/readers");

  return data;
}

export async function pairPosReader(params: {
  pairingCode: string;
  name: string;
}): Promise<PosReader> {
  const { data } = await api.post<{ reader: PosReader }>(
    "/pos/readers/pair",
    params,
  );

  return data.reader;
}

export async function deletePosReader(readerId: string): Promise<void> {
  await api.delete(`/pos/readers/${encodeURIComponent(readerId)}`);
}

export async function fetchPosCatalog(): Promise<PosCatalog> {
  const { data } = await api.get<PosCatalog>("/pos/catalog");

  return data;
}

export async function resolvePosGuest(body: {
  credential?: string | null;
  email?: string | null;
  phoneE164?: string | null;
  givenName?: string | null;
  familyName?: string | null;
}): Promise<PosResolvedGuest> {
  const { data } = await api.post<PosResolvedGuest>("/pos/guest/resolve", body);

  return data;
}

export async function previewPosPricing(body: {
  exclusiveTierId: string;
  addonTierIds: string[];
}): Promise<PosPricingPreview> {
  const { data } = await api.post<PosPricingPreview>(
    "/pos/pricing-preview",
    body,
  );

  return data;
}

export async function createPosSale(body: {
  readerId: string;
  locale: "de" | "en" | "it";
  exclusiveTierId: string;
  addonTierIds: string[];
  credential?: string | null;
  email?: string | null;
  phoneE164?: string | null;
  givenName?: string | null;
  familyName?: string | null;
}): Promise<PosSaleCreateResult> {
  const { data } = await api.post<PosSaleCreateResult>("/pos/sale", body);

  return data;
}

export async function cancelPosSale(orderId: string): Promise<void> {
  await api.post(`/pos/sale/${orderId}/cancel`);
}

export async function fetchPosSaleStatus(
  orderId: string,
): Promise<PosSaleStatus> {
  const { data } = await api.get<PosSaleStatus>(`/pos/sale/${orderId}`);

  return data;
}
