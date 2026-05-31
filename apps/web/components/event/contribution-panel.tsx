"use client";

import type { QueryKey } from "@tanstack/react-query";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import type { EventTier } from "@/helpers/eventsApi";

import { Elements } from "@stripe/react-stripe-js";
import { AxiosError } from "axios";
import { useCallback, useRef } from "react";
import { Checkbox } from "@heroui/react";
import { Radio, RadioGroup } from "@heroui/radio";

import { NeonCard, NeonCardBody } from "@/components/neon-card";
import { ContributionStepper } from "@/components/event/contribution-stepper";
import { ContributionSummary } from "@/components/event/contribution-summary";
import { EventCostTransparency } from "@/components/event/event-cost-transparency";
import { PaymentStep } from "@/components/event/payment-step";
import { FormError } from "@/components/form-error";
import { NeonButton } from "@/components/neon-button";
import { NeonInput } from "@/components/neon-input";
import { NeonTextButton } from "@/components/neon-text-button";
import { ParticipantSessionPanel } from "@/components/participant-session-panel";
import { formatContributionCta } from "@/helpers/contribution-labels";
import {
  formatPlacesRemaining,
  formatTierPrice,
  isSelectableTier,
} from "@/helpers/event-tier-utils";

type ContributionPanelLabels = {
  contributionTitle: string;
  contributionSubtitle: string;
  checkoutStepChoose: string;
  checkoutStepPay: string;
  changeLevel: string;
  addonsTitle: string;
  placesRemaining: string;
  placesUnlimited: string;
  soldOut: string;
  checkoutSelectTier: string;
  checkoutEnterContact: string;
  loading: string;
  email: string;
  phone: string;
  contactPrivacyHint: string;
  alreadyRegistered: string;
  checkoutOnePersonHint: string;
  pay: string;
  intentError: string;
  checkoutOrderSummary: string;
  checkoutTotal: string;
  checkoutSubtotal: string;
  promoCodeLabel: string;
  promoDiscount: string;
  promoInvalid: string;
  costTransparencyTitle: string;
  costTransparencyBullets: string[];
  costTransparencyDisclaimer: string;
  completeRegistration: string;
  confirmContribution: string;
  allTiersSoldOut: string;
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
  welcomeLine?: string;
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
  welcomeLine,
}: ContributionPanelProps) {
  const paymentRef = useRef<HTMLDivElement>(null);
  const step: 1 | 2 = clientSecret ? 2 : 1;

  const ctaLabel = formatContributionCta(displayTotalCents, {
    completeRegistration: labels.completeRegistration,
    confirmContribution: labels.confirmContribution,
  });

  const scrollToPayment = useCallback(() => {
    paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const allExclusiveSoldOut =
    exclusiveTiers.length > 0 &&
    exclusiveTiers.every((tier) => !isSelectableTier(tier));

  return (
    <NeonCard
      data-testid={
        hasCheckoutProfile
          ? "event-checkout-minimal"
          : "event-checkout-with-contact"
      }
      id={id}
      surface="default"
    >
      <NeonCardBody padding="checkout">
        <ContributionStepper
          changeLevelLabel={labels.changeLevel}
          chooseLabel={labels.checkoutStepChoose}
          completeLabel={labels.checkoutStepPay}
          step={step}
          onChangeLevel={step === 2 ? onChangeLevel : undefined}
        />

        <EventCostTransparency
          bullets={labels.costTransparencyBullets}
          title={labels.costTransparencyTitle}
        />

        <h2 className="neon-title-section mb-1" id="event-checkout-heading">
          {labels.contributionTitle}
        </h2>
        <p className="neon-meta mb-6">{labels.contributionSubtitle}</p>

        {welcomeLine ? (
          <p className="text-sm font-semibold text-foreground/80 mb-4">
            {welcomeLine}
          </p>
        ) : null}

        {allExclusiveSoldOut ? (
          <p className="text-sm text-foreground/50 mb-6">
            {labels.allTiersSoldOut}
          </p>
        ) : null}

        {exclusiveTiers.length > 0 ? (
          <RadioGroup
            aria-labelledby="event-checkout-heading"
            classNames={{ wrapper: "gap-8" }}
            isDisabled={checkoutLocked}
            value={selectedExclusiveId ?? ""}
            onValueChange={onExclusiveChange}
          >
            {exclusiveTiers.map((tier) => {
              const tierDescription = tier.description.trim();
              const priceLabel = formatTierPrice(tier);
              const placesLabel = formatPlacesRemaining(
                tier,
                labels.placesRemaining,
                labels.placesUnlimited,
                labels.soldOut,
              );
              const disabled = !isSelectableTier(tier);

              return (
                <Radio
                  key={tier.id}
                  classNames={{
                    base: "neon-surface-default p-4 max-w-full m-0 data-[selected=true]:border-neon/40 opacity-100 data-[disabled=true]:opacity-50",
                    wrapper: "mt-0.5",
                    label: "w-full max-w-full",
                    labelWrapper: "w-full max-w-full",
                    description:
                      "text-xs text-foreground/45 leading-relaxed mt-1.5",
                  }}
                  data-testid={`event-checkout-exclusive-${tier.id}`}
                  description={tierDescription || undefined}
                  isDisabled={disabled || checkoutLocked}
                  value={tier.id}
                >
                  <span className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm font-medium text-foreground/80">
                      {tier.name}
                    </span>
                    <span className="text-xs font-mono text-foreground/45 shrink-0">
                      {priceLabel} · {placesLabel}
                    </span>
                  </span>
                </Radio>
              );
            })}
          </RadioGroup>
        ) : null}

        {addonTiers.length > 0 ? (
          <div className="mt-8 space-y-4">
            <p className="neon-label">{labels.addonsTitle}</p>
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
                    className="neon-surface-default p-4 data-[selected=true]:border-neon/40"
                    data-selected={isSelected ? true : undefined}
                  >
                    <Checkbox
                      classNames={{
                        base: "max-w-full m-0 items-start",
                        label: "w-full max-w-full",
                      }}
                      data-testid={`event-checkout-addon-${tier.id}`}
                      isDisabled={disabled || checkoutLocked}
                      isSelected={isSelected}
                      onValueChange={(checked) =>
                        onAddonChange(tier.id, checked)
                      }
                    >
                      <span className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="text-sm font-medium text-foreground/80">
                          {tier.name}
                        </span>
                        <span className="text-xs font-mono text-foreground/45 shrink-0">
                          {priceLabel} · {placesLabel}
                        </span>
                      </span>
                    </Checkbox>
                    {tierDescription ? (
                      <p className="text-xs text-foreground/45 leading-relaxed mt-1.5 pl-7">
                        {tierDescription}
                      </p>
                    ) : null}
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
            checkoutTotal: labels.checkoutTotal,
            costTransparencyDisclaimer: labels.costTransparencyDisclaimer,
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

        {!hasCheckoutProfile ? (
          <div ref={signInSectionRef} className="mt-6">
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
            className="mt-6 space-y-3"
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
            <p className="text-xs text-foreground/40 leading-relaxed">
              {labels.contactPrivacyHint}
            </p>
          </div>
        ) : null}

        {!clientSecret ? (
          <div className="mt-6 space-y-2">
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
              <p className="text-xs text-foreground/40">
                {checkoutDisabledReason}
              </p>
            ) : null}
          </div>
        ) : null}

        {intentMutationError ? (
          <FormError className="mt-4">
            {intentMutationError instanceof AxiosError &&
            intentMutationError.response?.data &&
            typeof (intentMutationError.response.data as { error?: string })
              .error === "string"
              ? (intentMutationError.response.data as { error: string }).error
              : labels.intentError}
          </FormError>
        ) : null}

        {checkoutLocked && selectedTiers.length > 0 && clientSecret ? (
          <div className="mt-6 pt-6 border-t border-foreground/10">
            <p className="text-xs font-mono uppercase tracking-wider text-foreground/40 mb-1">
              {labels.checkoutOrderSummary}
            </p>
            <ul className="text-sm font-medium text-foreground/80 mb-2 space-y-1">
              {selectedTiers.map((tier) => (
                <li key={tier.id}>
                  {tier.name} — {formatTierPrice(tier)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {clientSecret && checkoutOrderId && stripePromise && elementsOptions ? (
          <div ref={paymentRef}>
            <Elements
              key={clientSecret}
              options={elementsOptions}
              stripe={stripePromise}
            >
              <PaymentStep
                onePersonHint={labels.checkoutOnePersonHint}
                payLabel={labels.pay}
                returnUrl={checkoutReturnUrl ?? returnUrl}
                onMounted={scrollToPayment}
                onPaymentSucceeded={onPaymentSucceeded}
              />
            </Elements>
          </div>
        ) : null}
      </NeonCardBody>
    </NeonCard>
  );
}
