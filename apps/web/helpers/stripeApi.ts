import { useQuery } from "@tanstack/react-query";

import { createPublicApiClient } from "@/helpers/createPublicApiClient";
import { donationTiersQueryKey } from "@/helpers/queryKeys";

const STRIPE_API_URL = process.env.NEXT_PUBLIC_STRIPE_API_URL;

const stripeClient = createPublicApiClient({
  envUrl: STRIPE_API_URL,
  envLabel: "NEXT_PUBLIC_STRIPE_API_URL",
  warnMissing: "always",
});

export interface CheckoutParams {
  priceId: string;
  mode: "subscription" | "payment";
  locale: "de" | "en" | "it";
  successUrl: string;
  cancelUrl: string;
}

export interface PortalRequestParams {
  email: string;
  locale: "de" | "en" | "it";
  returnUrl: string;
}

/**
 * Creates a Stripe Checkout Session and returns the checkout URL.
 */
export async function createCheckoutSession(
  params: CheckoutParams,
): Promise<string> {
  const { data } = await stripeClient.post<{ url: string }>(
    "/checkout",
    params,
  );

  return data.url;
}

/**
 * Requests a magic link email for managing an existing donation.
 * Throws an AxiosError with status 404 if no donation is found.
 */
export async function requestPortalLink(
  params: PortalRequestParams,
): Promise<void> {
  await stripeClient.post("/portal/request", params);
}

/* ------------------------------------------------------------------ */
/*  Donation tiers                                                     */
/* ------------------------------------------------------------------ */

export interface DonationTier {
  priceId: string;
  amount: number;
}

export type DonationTiers = Record<"recurring" | "onetime", DonationTier[]>;

/**
 * Fetches active donation products and prices from the Cloud Function.
 */
export async function fetchDonationTiers(): Promise<DonationTiers> {
  const { data } = await stripeClient.get<DonationTiers>("/donations");

  return data;
}

/**
 * React Query hook for donation tiers. Cached for 5 minutes.
 */
export function useDonationTiers() {
  return useQuery({
    queryKey: donationTiersQueryKey,
    queryFn: fetchDonationTiers,
    staleTime: 5 * 60 * 1000,
  });
}
