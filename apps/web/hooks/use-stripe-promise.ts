"use client";

import { useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

export function useStripePromise() {
  return useMemo(() => {
    if (!publishableKey) {
      return null;
    }

    return loadStripe(publishableKey);
  }, []);
}
