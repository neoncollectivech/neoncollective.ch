"use client";

import type { QueryKey } from "@tanstack/react-query";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import type { EventTier } from "@/helpers/eventsApi";

import { Elements } from "@stripe/react-stripe-js";
import { AxiosError } from "axios";
import clsx from "clsx";
import { useCallback, useRef } from "react";
import { Checkbox } from "@heroui/react";
import { Radio, RadioGroup } from "@heroui/radio";

import { NeonCard, NeonCardBody } from "@/components/neon-card";
import { neonPanelInsetPaddingClass } from "@/config/modal-chrome";
import { ContributionStepper } from "@/components/event/contribution-stepper";
import { ContributionSummary } from "@/components/event/contribution-summary";
import { PaymentStep } from "@/components/event/payment-step";
import { FormError } from "@/components/form-error";
import { NeonButton } from "@/components/neon-button";
import { NeonInput } from "@/components/neon-input";
import { NeonTextButton } from "@/components/neon-text-button";
import { ParticipantSessionPanel } from "@/components/participant-session-panel";
import { formatPayShareCta } from "@/helpers/pay-share-cta";
import {
  formatPlacesRemaining,
  formatTierPrice,
  isSelectableTier,
} from "@/helpers/event-tier-utils";

type ContributionPanelLabels = {
  registerTitle: string;
  registerSubtitle: string;
  passTitle: string;
  checkoutStepChoose: string;
  checkoutStepPay: string;
  checkoutStepConfirm: string;
  changePass: string;
  activitiesTitle: string;
  activitiesHint: string;
  placesRemaining: string;
  placesUnlimited: string;
  soldOut: string;
  checkoutEnterContact: string;
  loading: string;
  email: string;
  phone: string;
  contactPrivacyHint: string;
  alreadyRegistered: string;
  checkoutOnePersonHint: string;
  payYourShareButton: string;
  intentError: string;
  checkoutYourShare: string;
  checkoutSubtotal: string;
  promoCodeLabel: string;
  promoDiscount: string;
  promoInvalid: string;
  completeRegistration: string;
  payYourShare: string;
  allPassesSoldOut: string;
};

type ContributionPanelProps = {
  id?: string;
  labels: ContributionPanelLabels;
  exclusiveTiers: EventTier[];
  addonTiers: EventTier[];
  selectedExclusiveId: string | null;
  selectedAddonIds: Set<string>;
  onExclusiveChange: (id: string) => void;
  onAddonChange: (tierId: string, checked: boolean) => void;
  selectedTiers: EventTier[];
  displayTotalCents: number;
  promo: string | undefined;
  showPromoSubtotal: boolean;
  previewSubtotalCents: number | undefined;
  previewDiscountCents: number | undefined;
  promoInvalid: boolean;
  showContactForm: boolean;
  hasCheckoutProfile: boolean;
  email: string;
  phone: string;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  sessionReturnPath: string;
  codeHandled: boolean;
  sessionQueryKeys: QueryKey[];
  signInExpanded: boolean;
  onSignInExpandedChange: (open: boolean) => void;
  signInSectionRef: React.RefObject<HTMLDivElement | null>;
  checkoutLocked: boolean;
  clientSecret: string | null;
  checkoutOrderId: string | null;
  checkoutReturnUrl: string | null;
  returnUrl: string;
  stripePromise: ReturnType<
    typeof import("@/hooks/use-stripe-promise").useStripePromise
  >;
  elementsOptions: StripeElementsOptions | undefined;
  intentMutationPending: boolean;
  intentMutationError: unknown;
  tierSelectionReady: boolean;
  profileLoading: boolean;
  checkoutContactReady: boolean;
  checkoutDisabledReason: string | null;
  onConfirmContribution: () => void;
  onChangeLevel: () => void;
  onPaymentSucceeded: () => void;
};

export function ContributionPanel({
  id = "event-contribution",
  labels,
  exclusiveTiers,
  addonTiers,
  selectedExclusiveId,
  selectedAddonIds,
  onExclusiveChange,
  onAddonChange,
  selectedTiers,
  displayTotalCents,
  promo,
  showPromoSubtotal,
  previewSubtotalCents,
  previewDiscountCents,
  promoInvalid,
  showContactForm,
  hasCheckoutProfile,
  email,
  phone,
  onEmailChange,
  onPhoneChange,
  sessionReturnPath,
  codeHandled,
  sessionQueryKeys,
  signInExpanded,
  onSignInExpandedChange,
  signInSectionRef,
  checkoutLocked,
  clientSecret,
  checkoutOrderId,
  checkoutReturnUrl,
  returnUrl,
  stripePromise,
  elementsOptions,
  intentMutationPending,
  intentMutationError,
  tierSelectionReady,
  profileLoading,
  checkoutContactReady,
  checkoutDisabledReason,
  onConfirmContribution,
  onChangeLevel,
  onPaymentSucceeded,
}: ContributionPanelProps) {
  const paymentRef = useRef<HTMLDivElement>(null);
  const step: 1 | 2 = clientSecret ? 2 : 1;

  const ctaLabel = formatPayShareCta(displayTotalCents, {
    completeRegistration: labels.completeRegistration,
    payYourShare: labels.payYourShare,
  });

  const passHeadingId =
    addonTiers.length > 0 ? "event-checkout-pass-heading" : "event-checkout-heading";

  const scrollToPayment = useCallback(() => {
    paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const allExclusiveSoldOut =
    exclusiveTiers.length > 0 &&
    exclusiveTiers.every((tier) => !isSelectableTier(tier));

  const showActionsSection =
    !hasCheckoutProfile || showContactForm || !clientSecret;

  return (
    <div
      className="min-w-0 scroll-mt-22 scroll-mb-28 lg:scroll-mb-6"
      id={id}
    >
      <NeonCard
        className="overflow-x-clip"
        data-testid={
          hasCheckoutProfile
            ? "event-checkout-minimal"
            : "event-checkout-with-contact"
        }
        surface="default"
      >
      <NeonCardBody padding="checkout">
        <div className="space-y-8">
          <ContributionStepper
            changeLevelLabel={labels.changePass}
            chooseLabel={labels.checkoutStepChoose}
            completeLabel={labels.checkoutStepPay}
            confirmLabel={labels.checkoutStepConfirm}
            step={step}
            onChangeLevel={step === 2 ? onChangeLevel : undefined}
          />

          <div>
            <h2 className="neon-title-section mb-3" id="event-checkout-heading">
              {labels.registerTitle}
            </h2>
            <p className="checkout-helper">{labels.registerSubtitle}</p>
          </div>

          {allExclusiveSoldOut ? (
            <p className="checkout-helper">{labels.allPassesSoldOut}</p>
          ) : null}

          {exclusiveTiers.length > 0 ? (
            <div className="space-y-4">
              {addonTiers.length > 0 ? (
                <p
                  className="checkout-section-title"
                  id="event-checkout-pass-heading"
                >
                  {labels.passTitle}
                </p>
              ) : null}
            <RadioGroup
              aria-labelledby={passHeadingId}
              className="min-w-0"
              classNames={{ wrapper: "gap-6 min-w-0 w-full" }}
              isDisabled={checkoutLocked}
              value={selectedExclusiveId ?? ""}
              onValueChange={onExclusiveChange}
            >
              {exclusiveTiers.map((tier) => {
                const tierDescription = tier.description.trim();
                const isSelected = selectedExclusiveId === tier.id;
                const priceLabel = formatTierPrice(tier);
                const placesLabel = formatPlacesRemaining(
                  tier,
                  labels.placesRemaining,
                  labels.placesUnlimited,
                  labels.soldOut,
                );
                const disabled = !isSelectableTier(tier);

                return (
                  <div
                    key={tier.id}
                    className={clsx(
                      "neon-surface-default",
                      neonPanelInsetPaddingClass,
                      isSelected && "border-neon/40",
                      (disabled || checkoutLocked) && "opacity-50",
                    )}
                  >
                    <Radio
                      classNames={{
                        base: "flex p-0 m-0 w-full max-w-full gap-4 items-start justify-start",
                        wrapper: "mt-0.5 shrink-0",
                        label: "w-full max-w-full min-w-0",
                        labelWrapper: "w-full max-w-full min-w-0",
                        description:
                          "text-xs text-foreground/45 leading-relaxed mt-1.5",
                      }}
                      data-testid={`event-checkout-exclusive-${tier.id}`}
                      description={
                        isSelected && tierDescription
                          ? tierDescription
                          : undefined
                      }
                      isDisabled={disabled || checkoutLocked}
                      value={tier.id}
                    >
                      <span className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="text-sm font-medium text-foreground/90 wrap-break-word min-w-0">
                          {tier.name}
                        </span>
                        <span className="text-xs font-mono text-foreground/45 shrink-0">
                          {priceLabel} · {placesLabel}
                        </span>
                      </span>
                    </Radio>
                  </div>
                );
              })}
            </RadioGroup>
            </div>
          ) : null}

          {addonTiers.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="checkout-section-title">{labels.activitiesTitle}</p>
                <p className="checkout-helper">{labels.activitiesHint}</p>
              </div>
              <div className="space-y-3">
                {addonTiers.map((tier) => {
                  const tierDescription = tier.description.trim();
                  const priceLabel = formatTierPrice(tier);
                  const placesLabel = formatPlacesRemaining(
                    tier,
                    labels.placesRemaining,
                    labels.placesUnlimited,
                    labels.soldOut,
                  );
                  const isSelected = selectedAddonIds.has(tier.id);
                  const disabled = !isSelectableTier(tier);

                  return (
                    <div
                      key={tier.id}
                      className={clsx(
                        "neon-surface-default",
                        neonPanelInsetPaddingClass,
                        isSelected && "border-neon/40",
                        (disabled || checkoutLocked) && "opacity-50",
                      )}
                    >
                      <Checkbox
                        classNames={{
                          base: "flex p-0 m-0 w-full max-w-full items-start gap-4",
                          label: "w-full max-w-full min-w-0",
                        }}
                        data-testid={`event-checkout-addon-${tier.id}`}
                        isDisabled={disabled || checkoutLocked}
                        isSelected={isSelected}
                        onValueChange={(checked) =>
                          onAddonChange(tier.id, checked)
                        }
                      >
                        <div className="w-full min-w-0">
                          <span className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <span className="text-sm font-medium text-foreground/90 wrap-break-word min-w-0">
                              {tier.name}
                            </span>
                            <span className="text-xs font-mono text-foreground/45 shrink-0">
                              {priceLabel} · {placesLabel}
                            </span>
                          </span>
                          {isSelected && tierDescription ? (
                            <p className="text-xs text-foreground/45 leading-relaxed mt-1.5">
                              {tierDescription}
                            </p>
                          ) : null}
                        </div>
                      </Checkbox>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <ContributionSummary
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

          {showActionsSection ? (
            <div className="space-y-8 border-t border-foreground/10 pt-8">
              {!hasCheckoutProfile ? (
                <div ref={signInSectionRef}>
                  <NeonTextButton
                    onClick={() => onSignInExpandedChange(!signInExpanded)}
                  >
                    {labels.alreadyRegistered}
                  </NeonTextButton>
                  {signInExpanded ? (
                    <div className="mt-4 pt-4 border-t border-foreground/10">
                      <ParticipantSessionPanel
                        embedded
                        codeExchangePending={!codeHandled}
                        returnPath={sessionReturnPath}
                        sessionEstablishedQueryKeys={sessionQueryKeys}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showContactForm ? (
                <div
                  className="space-y-4"
                  data-testid="event-checkout-contact-form"
                >
                  <NeonInput
                    isRequired
                    label={labels.email}
                    type="email"
                    value={email}
                    onValueChange={onEmailChange}
                  />
                  <NeonInput
                    label={labels.phone}
                    type="tel"
                    value={phone}
                    onValueChange={onPhoneChange}
                  />
                  <p className="checkout-helper text-foreground/45">
                    {labels.contactPrivacyHint}
                  </p>
                </div>
              ) : null}

              {!clientSecret ? (
                <div className="space-y-2">
                  <NeonButton
                    className="w-full"
                    data-testid="event-checkout-confirm-contribution"
                    isDisabled={
                      intentMutationPending ||
                      !tierSelectionReady ||
                      profileLoading ||
                      !checkoutContactReady ||
                      allExclusiveSoldOut
                    }
                    type="button"
                    onPress={onConfirmContribution}
                  >
                    {intentMutationPending ? "…" : ctaLabel}
                  </NeonButton>
                  {checkoutDisabledReason &&
                  (intentMutationPending ||
                    !tierSelectionReady ||
                    profileLoading ||
                    !checkoutContactReady) ? (
                    <p className="checkout-helper text-foreground/45">
                      {checkoutDisabledReason}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {intentMutationError ? (
            <FormError>
              {intentMutationError instanceof AxiosError &&
              intentMutationError.response?.data &&
              typeof (intentMutationError.response.data as { error?: string })
                .error === "string"
                ? (intentMutationError.response.data as { error: string }).error
                : labels.intentError}
            </FormError>
          ) : null}

          {clientSecret &&
          checkoutOrderId &&
          stripePromise &&
          elementsOptions ? (
            <div
              ref={paymentRef}
              className="min-w-0 overflow-x-clip border-t border-foreground/10 pt-8"
            >
              <Elements
                key={clientSecret}
                options={elementsOptions}
                stripe={stripePromise}
              >
                <PaymentStep
                  onePersonHint={labels.checkoutOnePersonHint}
                  payLabel={labels.payYourShareButton}
                  returnUrl={checkoutReturnUrl ?? returnUrl}
                  onMounted={scrollToPayment}
                  onPaymentSucceeded={onPaymentSucceeded}
                />
              </Elements>
            </div>
          ) : null}
        </div>
      </NeonCardBody>
      </NeonCard>
    </div>
  );
}
