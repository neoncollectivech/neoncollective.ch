"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Spinner } from "@heroui/react";
import clsx from "clsx";

import { useDictionary } from "@/i18n/DictionaryContext";
import {
  createCheckoutSession,
  useDonationTiers,
  type DonationTier,
} from "@/helpers/stripeApi";

type DonationMode = "recurring" | "onetime";

function formatAmount(amount: number): string {
  return `CHF ${amount}.—`;
}

export function DonationPicker() {
  const { dictionary, locale } = useDictionary();
  const t = dictionary.donationPicker;

  const [mode, setMode] = useState<DonationMode>("recurring");
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: tiers, isLoading, isError } = useDonationTiers();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("success") === "true") {
      setSuccess(true);
    }
  }, []);

  async function handleDonate(tier: DonationTier) {
    setLoadingPriceId(tier.priceId);

    try {
      const stripeMode = mode === "recurring" ? "subscription" : "payment";

      const url = await createCheckoutSession({
        priceId: tier.priceId,
        mode: stripeMode,
        locale,
        successUrl: `${window.location.origin}/${locale}/donate?success=true`,
        cancelUrl: `${window.location.origin}/${locale}/donate`,
      });

      window.location.href = url;
    } catch {
      setLoadingPriceId(null);
    }
  }

  if (success) {
    return (
      <Card className="border border-neon/30 bg-transparent" radius="sm">
        <CardBody className="px-8 py-10 text-center">
          <p className="text-lg text-neon font-mono uppercase tracking-widest mb-2">
            ✓
          </p>
          <p className="text-base md:text-lg text-foreground/60 leading-relaxed">
            {t.successMessage}
          </p>
        </CardBody>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner color="success" size="lg" />
      </div>
    );
  }

  if (isError || !tiers) {
    return (
      <p className="text-sm text-red-400/80 py-8">
        Could not load donation options. Please try again later.
      </p>
    );
  }

  const currentTiers = tiers[mode] ?? [];

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex gap-0 mb-12">
        <Button
          className={clsx(
            "font-mono text-xs uppercase tracking-widest px-6 transition-all duration-300 rounded-none rounded-l-sm",
            mode === "recurring"
              ? "border-neon/60 text-neon bg-neon/10"
              : "border-foreground/10 text-foreground/30 hover:text-foreground/50",
          )}
          radius="none"
          variant="bordered"
          onPress={() => setMode("recurring")}
        >
          {t.recurringLabel}
        </Button>
        <Button
          className={clsx(
            "font-mono text-xs uppercase tracking-widest px-6 transition-all duration-300 rounded-none rounded-r-sm -ml-px",
            mode === "onetime"
              ? "border-neon/60 text-neon bg-neon/10"
              : "border-foreground/10 text-foreground/30 hover:text-foreground/50",
          )}
          radius="none"
          variant="bordered"
          onPress={() => setMode("onetime")}
        >
          {t.onetimeLabel}
        </Button>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {currentTiers.map((tier) => {
          const isItemLoading = loadingPriceId === tier.priceId;

          return (
            <Card
              key={tier.priceId}
              isPressable
              className={clsx(
                "border border-foreground/10 bg-transparent transition-all duration-300",
                "hover:border-neon/60 hover:bg-neon/5",
                isItemLoading && "opacity-60",
              )}
              isDisabled={loadingPriceId !== null}
              radius="none"
              onPress={() => handleDonate(tier)}
            >
              <CardBody className="px-6 py-10 text-center">
                <span className="block text-2xl md:text-3xl font-bold text-foreground/90 mb-2 group-hover:text-neon transition-colors duration-300">
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
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
