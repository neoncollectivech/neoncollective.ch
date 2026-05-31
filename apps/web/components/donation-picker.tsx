"use client";

import type { DonationTier } from "@/helpers/stripeApi";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import clsx from "clsx";

import { NeonCard, NeonCardBody } from "@/components/neon-card";
import { FormError } from "@/components/form-error";
import { NeonButton } from "@/components/neon-button";
import { PageSpinner } from "@/components/page-spinner";
import { absoluteSiteUrl, navigateExternally } from "@/helpers/site-url";
import { useDictionary } from "@/i18n/DictionaryContext";
import { useLocale } from "@/hooks/use-locale";
import { stripeApi } from "@/hooks/use-stripe-api";

type DonationMode = "recurring" | "onetime";

function formatAmount(amount: number): string {
  return `CHF ${amount}.—`;
}

const toggleInactive =
  "!border-foreground/10 !text-foreground/30 hover:!text-foreground/50 hover:!bg-transparent hover:!border-foreground/10";

function DonationPickerInner() {
  const { dictionary } = useDictionary();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const t = dictionary.donationPicker;

  const [mode, setMode] = useState<DonationMode>("recurring");
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const checkoutMutation = useMutation(stripeApi.checkout.session());
  const {
    data: tiers,
    isLoading,
    isError,
  } = useQuery(stripeApi.donation.tiers());

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setSuccess(true);
    }
  }, [searchParams]);

  async function handleDonate(tier: DonationTier) {
    setLoadingPriceId(tier.priceId);

    try {
      const stripeMode = mode === "recurring" ? "subscription" : "payment";

      const url = await checkoutMutation.mutateAsync({
        priceId: tier.priceId,
        mode: stripeMode,
        locale,
        successUrl: absoluteSiteUrl(`/${locale}/donate?success=true`),
        cancelUrl: absoluteSiteUrl(`/${locale}/donate`),
      });

      navigateExternally(url);
    } catch {
      setLoadingPriceId(null);
    }
  }

  if (success) {
    return (
      <NeonCard surface="accent">
        <NeonCardBody className="text-center">
          <p className="text-lg text-neon font-mono uppercase tracking-widest mb-2">
            ✓
          </p>
          <p className="text-base md:text-lg text-foreground/60 leading-relaxed">
            {t.successMessage}
          </p>
        </NeonCardBody>
      </NeonCard>
    );
  }

  if (isLoading) {
    return <PageSpinner />;
  }

  if (isError || !tiers) {
    return (
      <FormError className="py-8">
        Could not load donation options. Please try again later.
      </FormError>
    );
  }

  const currentTiers = tiers[mode] ?? [];

  return (
    <div>
      <div className="flex gap-0 mb-12">
        <NeonButton
          className={clsx(
            "px-6",
            mode === "recurring" ? "bg-neon/10" : toggleInactive,
          )}
          type="button"
          onPress={() => setMode("recurring")}
        >
          {t.recurringLabel}
        </NeonButton>
        <NeonButton
          className={clsx(
            "px-6 -ml-px",
            mode === "onetime" ? "bg-neon/10" : toggleInactive,
          )}
          type="button"
          onPress={() => setMode("onetime")}
        >
          {t.onetimeLabel}
        </NeonButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {currentTiers.map((tier) => {
          const isItemLoading = loadingPriceId === tier.priceId;

          return (
            <NeonCard
              key={tier.priceId}
              isPressable
              className={clsx(
                "bg-transparent transition-all duration-300",
                "hover:border-neon/60 hover:bg-neon/5",
                isItemLoading && "opacity-60",
              )}
              isDisabled={loadingPriceId !== null}
              surface="default"
              onPress={() => handleDonate(tier)}
            >
              <NeonCardBody className="text-center">
                <span className="neon-title-page mb-2 block group-hover:text-neon transition-colors duration-300">
                  {formatAmount(tier.amount)}
                </span>
                {mode === "recurring" && (
                  <span className="block text-xs font-mono text-foreground/30 uppercase tracking-widest">
                    {t.perYear}
                  </span>
                )}
                <span className="block mt-6 font-mono text-xs uppercase tracking-widest text-foreground/25 group-hover:text-neon/60 transition-colors duration-300">
                  {isItemLoading ? "…" : t.ctaLabel}
                </span>
              </NeonCardBody>
            </NeonCard>
          );
        })}
      </div>
    </div>
  );
}

export function DonationPicker() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <DonationPickerInner />
    </Suspense>
  );
}
