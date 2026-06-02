"use client";

import type { EventTier } from "@/helpers/eventsApi";

import { Spinner } from "@heroui/react";

import { ContributionStepper } from "@/components/event/contribution-stepper";
import { ContributionSummary } from "@/components/event/contribution-summary";
import { FormError } from "@/components/form-error";
import { NeonCard, NeonCardBody } from "@/components/neon-card";

type RegistrationPendingPanelLabels = {
  checkoutStepChoose: string;
  checkoutStepPay: string;
  checkoutStepConfirm: string;
  checkoutPaymentReceived: string;
  checkoutConfirming: string;
  confirmingNextSteps: string;
  checkoutYourShare: string;
  checkoutSubtotal: string;
  promoCodeLabel: string;
  promoDiscount: string;
  promoInvalid: string;
};

type RegistrationPendingPanelProps = {
  labels: RegistrationPendingPanelLabels;
  selectedTiers: EventTier[];
  displayTotalCents: number;
  promo: string | undefined;
  showPromoSubtotal: boolean;
  previewSubtotalCents: number | undefined;
  previewDiscountCents: number | undefined;
  promoInvalid: boolean;
  errorMessage?: string | null;
};

export function RegistrationPendingPanel({
  labels,
  selectedTiers,
  displayTotalCents,
  promo,
  showPromoSubtotal,
  previewSubtotalCents,
  previewDiscountCents,
  promoInvalid,
  errorMessage,
}: RegistrationPendingPanelProps) {
  return (
    <NeonCard
      className="overflow-x-clip"
      data-testid="event-checkout-confirming"
      id="event-contribution"
      surface="default"
    >
      <NeonCardBody padding="checkout">
        <div className="space-y-8">
          <ContributionStepper
            chooseLabel={labels.checkoutStepChoose}
            completeLabel={labels.checkoutStepPay}
            confirmLabel={labels.checkoutStepConfirm}
            step={3}
          />

          <div>
            <h2 className="neon-title-section mb-2">
              {labels.checkoutPaymentReceived}
            </h2>
            <p className="neon-meta">{labels.checkoutConfirming}</p>
            <p className="text-xs text-foreground/40 leading-relaxed mt-2">
              {labels.confirmingNextSteps}
            </p>
          </div>

          <ContributionSummary
            unbordered
            displayTotalCents={displayTotalCents}
            labels={{
              checkoutSubtotal: labels.checkoutSubtotal,
              checkoutYourShare: labels.checkoutYourShare,
              promoCodeLabel: labels.promoCodeLabel,
              promoDiscount: labels.promoDiscount,
              promoInvalid: labels.promoInvalid,
            }}
            previewDiscountCents={previewDiscountCents}
            previewSubtotalCents={previewSubtotalCents}
            promo={promo}
            promoInvalid={promoInvalid}
            selectedTiers={selectedTiers}
            showPromoSubtotal={showPromoSubtotal}
          />

          {errorMessage ? (
            <FormError>{errorMessage}</FormError>
          ) : (
            <div className="flex justify-center pt-2">
              <Spinner color="success" size="md" />
            </div>
          )}
        </div>
      </NeonCardBody>
    </NeonCard>
  );
}
