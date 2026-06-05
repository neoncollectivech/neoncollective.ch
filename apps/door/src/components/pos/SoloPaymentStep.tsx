import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { posApi } from "@/hooks/use-pos-api/api";
import { getApiErrorMessage } from "@/lib/api-error";

function formatPrice(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "CHF",
  }).format(cents / 100);
}

type SoloPaymentStepProps = {
  orderId: string;
  amountCents: number;
  readerName: string | null;
  onPaid: (
    signedCredential: string,
    guestName: string | null,
    tiers: string | null,
  ) => void;
  onCancelled: () => void;
};

export function SoloPaymentStep({
  orderId,
  amountCents,
  readerName,
  onPaid,
  onCancelled,
}: SoloPaymentStepProps) {
  const statusQuery = useQuery(posApi.sale.status(orderId));
  const cancelMutation = useMutation(posApi.sale.cancel());

  const status = statusQuery.data;
  const isPaid =
    status?.status === "paid" || status?.paymentStatus === "successful";
  const isFailed =
    status?.status === "failed" || status?.paymentStatus === "failed";

  useEffect(() => {
    if (isPaid && status?.signedCredential) {
      onPaid(status.signedCredential, status.guestName, status.tiers);
    }
  }, [
    isPaid,
    onPaid,
    status?.guestName,
    status?.signedCredential,
    status?.tiers,
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Present card on Solo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-3xl font-semibold tabular-nums">
          {formatPrice(amountCents)}
        </p>
        {readerName ? (
          <p className="text-muted-foreground text-sm">Reader: {readerName}</p>
        ) : null}
        {!isFailed ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Waiting for payment on the reader…
          </div>
        ) : (
          <p className="text-destructive text-sm">
            Payment failed or was cancelled.
          </p>
        )}
        <Button
          className="w-full"
          disabled={cancelMutation.isPending || isPaid}
          type="button"
          variant="outline"
          onClick={async () => {
            try {
              await cancelMutation.mutateAsync(orderId);
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
