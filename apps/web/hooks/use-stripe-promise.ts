"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useMemo } from "react";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

let stripePromiseSingleton: Promise<Stripe | null> | null = null;

function getStripePromise(): Promise<Stripe | null> | null {
  if (!publishableKey) {
    return null;
  }
  if (!stripePromiseSingleton) {
    stripePromiseSingleton = loadStripe(publishableKey);
  }

  return stripePromiseSingleton;
}

export function useStripePromise() {
  return useMemo(() => getStripePromise(), []);
}
