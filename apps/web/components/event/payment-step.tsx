"use client";

import {
  useStripe,
  useElements,
  PaymentElement,
} from "@stripe/react-stripe-js";
import { useState, useEffect, useRef } from "react";

import { FormError } from "@/components/form-error";
import { NeonButton } from "@/components/neon-button";

type PaymentStepProps = {
  payLabel: string;
  onePersonHint: string;
  returnUrl: string;
  onPaymentSucceeded: () => void;
  onMounted?: () => void;
};

export function PaymentStep({
  payLabel,
  onePersonHint,
  returnUrl,
  onPaymentSucceeded,
  onMounted,
}: PaymentStepProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    onMounted?.();
  }, [onMounted]);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) {
      return;
    }
    setBusy(true);
    setErr(null);
    const redirectReturnUrl =
      returnUrl.trim() ||
      (typeof window !== "undefined" ? window.location.href : "");

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: redirectReturnUrl },
      redirect: "if_required",
    });

    if (error) {
      setBusy(false);
      setErr(error.message ?? "Payment failed.");

      return;
    }

    onPaymentSucceeded();
    setBusy(false);
  }

  return (
    <form
      ref={formRef}
      className="mt-6 space-y-4"
      data-testid="event-checkout-payment-step"
      onSubmit={handlePay}
    >
      <PaymentElement
        options={{
          wallets: {
            link: "never",
          },
        }}
      />
      <p className="text-xs text-foreground/40">{onePersonHint}</p>
      {err ? <FormError>{err}</FormError> : null}
      <NeonButton
        className="w-full sm:w-auto"
        data-testid="event-checkout-pay"
        isDisabled={!stripe || busy}
        type="submit"
      >
        {busy ? "…" : payLabel}
      </NeonButton>
    </form>
  );
}
