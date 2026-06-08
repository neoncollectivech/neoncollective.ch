import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { posApi } from "@/hooks/use-pos-api/api";
import { getApiErrorMessage } from "@/lib/api-error";
import { isIosDevice, isStandaloneDisplay } from "@/lib/pwa-install";
import {
  PENDING_APP_SWITCH_HANDOFF_KEY,
  PENDING_APP_SWITCH_ORDER_KEY,
} from "@/lib/sumup-app-switch";

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

type AppSwitchPaymentStepProps = {
  orderId: string;
  amountCents: number;
  currency: string;
  handoffUrl: string;
  onPaid: (guestName: string | null, tiers: string | null) => void;
  onCancelled: () => void;
};

export function AppSwitchPaymentStep({
  orderId,
  amountCents,
  currency,
  handoffUrl,
  onPaid,
  onCancelled,
}: AppSwitchPaymentStepProps) {
  const queryClient = useQueryClient();
  const cancelMutation = useMutation(posApi.sale.cancel());
  const [openedSumUp, setOpenedSumUp] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const checkingRef = useRef(false);

  useEffect(() => {
    sessionStorage.setItem(PENDING_APP_SWITCH_ORDER_KEY, orderId);
    sessionStorage.setItem(PENDING_APP_SWITCH_HANDOFF_KEY, handoffUrl);
  }, [handoffUrl, orderId]);

  const clearPending = useCallback(() => {
    sessionStorage.removeItem(PENDING_APP_SWITCH_ORDER_KEY);
    sessionStorage.removeItem(PENDING_APP_SWITCH_HANDOFF_KEY);
  }, []);

  const checkPayment = useCallback(async () => {
    if (checkingRef.current) {
      return;
    }
    checkingRef.current = true;
    setConfirming(true);
    try {
      const status = await queryClient.fetchQuery(posApi.sale.status(orderId));

      if (status.status === "paid" || status.paymentStatus === "successful") {
        clearPending();
        onPaid(status.guestName, status.tiers);

        return;
      }
      if (status.status === "failed" || status.paymentStatus === "failed") {
        toast.error("Payment failed or was cancelled.");
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not check payment."));
    } finally {
      checkingRef.current = false;
      setConfirming(false);
    }
  }, [clearPending, onPaid, orderId, queryClient]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (!openedSumUp) {
        return;
      }
      toast.message("Checking payment…");
      void checkPayment();
    };

    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [checkPayment, openedSumUp]);

  const openSumUp = () => {
    setOpenedSumUp(true);
    window.location.href = handoffUrl;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pay in SumUp app</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-3xl font-semibold tabular-nums">
          {formatPrice(amountCents, currency)}
        </p>
        <p className="text-muted-foreground text-sm">Payment: Tap to Pay</p>
        <p className="text-sm">
          After paying in SumUp, switch back to NEON Door to confirm the sale.
        </p>
        {isStandaloneDisplay() && isIosDevice() ? (
          <p className="text-muted-foreground text-xs">
            SumUp may not open Door automatically. Use the home screen icon.
          </p>
        ) : null}
        {!openedSumUp ? (
          <p className="text-muted-foreground text-sm">
            Tap Open SumUp to take payment.
          </p>
        ) : confirming ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Confirming payment…
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Waiting for payment in SumUp…
          </p>
        )}
        <Button className="w-full" type="button" onClick={openSumUp}>
          Open SumUp
        </Button>
        <Button
          className="w-full"
          disabled={cancelMutation.isPending}
          type="button"
          variant="outline"
          onClick={async () => {
            try {
              await cancelMutation.mutateAsync(orderId);
              clearPending();
              onCancelled();
            } catch (error) {
              toast.error(
                getApiErrorMessage(error, "Could not cancel payment."),
              );
            }
          }}
        >
          Cancel
        </Button>
      </CardContent>
    </Card>
  );
}
