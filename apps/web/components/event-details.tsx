"use client";

import type { StripeElementsOptions } from "@stripe/stripe-js";
import type { Locale } from "@/i18n/config";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, Suspense } from "react";
import { AxiosError } from "axios";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Card, CardBody } from "@heroui/card";
import { Checkbox } from "@heroui/react";
import { Radio, RadioGroup } from "@heroui/radio";
import { Spinner } from "@heroui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FormError } from "@/components/form-error";
import { absoluteSiteUrl, getSiteOrigin } from "@/helpers/site-url";
import { NeonButton } from "@/components/neon-button";
import { NeonInput } from "@/components/neon-input";
import { NeonLink } from "@/components/neon-link";
import { ParticipantProfileModal } from "@/components/participant-profile-modal";
import { ParticipantSessionPanel } from "@/components/participant-session-panel";
import { useDictionary } from "@/i18n/DictionaryContext";
import { useEventUrlParams } from "@/hooks/use-event-url-params";
import { usePersistedEventLinkQuery } from "@/hooks/use-persisted-event-link-query";
import { useLocale } from "@/hooks/use-locale";
import { useProfileModalLabels } from "@/hooks/use-profile-modal-labels";
import { useStripePromise } from "@/hooks/use-stripe-promise";
import {
  eventsApi,
  eventsKeys,
  useCheckoutConfirmation,
  useExchangeRegistrationCode,
  useProfileBootstrap,
  writeParticipantProfileCache,
  type EventPayload,
  type EventTier,
  type InviteLinkConversion,
  type RegisteredOrderTier,
} from "@/hooks/use-events-api";
import {
  formatLocaleDate,
  formatLocaleDateTime,
} from "@/helpers/format-locale-datetime";

function formatTierPrice(tier: EventTier): string {
  return `${(tier.priceCents / 100).toFixed(0)} ${tier.currency.toUpperCase()}`;
}

function formatRegisteredTierPrice(tier: RegisteredOrderTier): string {
  return `${(tier.priceCents / 100).toFixed(0)} ${tier.currency.toUpperCase()}`;
}

function RegistrationConfirmedSummary({
  viewerGivenName,
  eventStartsAt,
  tiers,
  locale,
  labels,
}: {
  viewerGivenName?: string;
  eventStartsAt: string | null;
  tiers: RegisteredOrderTier[];
  locale: Locale;
  labels: {
    intro: string;
    introNoName: string;
    bodyNoTier: string;
    addon: string;
  };
}) {
  if (tiers.length === 0) {
    return (
      <p className="text-base text-neon/80 leading-relaxed">
        {labels.bodyNoTier}
      </p>
    );
  }

  const when = eventStartsAt
    ? formatLocaleDateTime(eventStartsAt, locale)
    : null;
  const hasName = Boolean(viewerGivenName?.trim());
  const intro = (hasName ? labels.intro : labels.introNoName).replaceAll(
    "{name}",
    viewerGivenName ?? "",
  );

  return (
    <div className="space-y-4">
      <p className="text-base text-neon/80 leading-relaxed">{intro}</p>
      <ul className="space-y-4" data-testid="registration-confirmed-tiers">
        {tiers.map((tier) => {
          const description = tier.description.trim();
          const metaParts = [
            when,
            tier.priceCents > 0 ? formatRegisteredTierPrice(tier) : null,
            tier.selectionMode === "addon" ? labels.addon : null,
          ].filter((part): part is string => Boolean(part));

          return (
            <li
              key={tier.id}
              className="border-t border-foreground/10 pt-4 first:border-t-0 first:pt-0"
            >
              <p className="text-sm font-semibold text-foreground/85">
                {tier.name}
              </p>
              {metaParts.length > 0 ? (
                <p className="text-xs font-mono text-foreground/45 mt-1">
                  {metaParts.join(" · ")}
                </p>
              ) : null}
              {description ? (
                <p className="text-sm text-foreground/50 leading-relaxed mt-2">
                  {description}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatPlacesRemaining(
  tier: EventTier,
  placesRemainingLabel: string,
  placesUnlimitedLabel: string,
): string {
  if (tier.placesRemaining == null) {
    return placesUnlimitedLabel;
  }

  return `${tier.placesRemaining} ${placesRemainingLabel}`;
}

function isAddonTier(tier: EventTier): boolean {
  return tier.selectionMode === "addon";
}

function isExclusiveTier(tier: EventTier): boolean {
  return !isAddonTier(tier);
}

function isSelectableTier(tier: EventTier): boolean {
  return tier.placesRemaining == null || tier.placesRemaining > 0;
}

/** Auto-pick when there is exactly one exclusive tier, or only one that still has capacity. */
function defaultExclusiveTierId(tiers: EventTier[]): string | null {
  const exclusive = tiers.filter(isExclusiveTier);

  if (exclusive.length === 1) {
    return exclusive[0]!.id;
  }
  const selectableExclusive = exclusive.filter(isSelectableTier);

  if (selectableExclusive.length === 1) {
    return selectableExclusive[0]!.id;
  }

  return null;
}

function EventHero({
  title,
  startsAt,
  location,
  imageUrl,
  imageAlt,
  locale,
  backHref,
  backLabel,
  locationLabel,
}: {
  title: string;
  startsAt: string | null;
  location: string | null;
  imageUrl: string | undefined;
  imageAlt: string;
  locale: Locale;
  backHref: string;
  backLabel: string;
  locationLabel: string;
}) {
  const locationLine = location?.trim();
  const metaParts = [
    startsAt ? formatLocaleDateTime(startsAt, locale) : null,
    locationLine,
  ].filter(Boolean);

  return (
    <header className="mb-10 md:mb-12">
      <NeonLink
        className="text-sm text-foreground/45 mb-6 inline-block"
        href={backHref}
        neonStyle="inline"
      >
        ← {backLabel}
      </NeonLink>

      {imageUrl ? (
        <div className="mb-6 border border-foreground/10 overflow-hidden bg-foreground/2">
          <img
            alt={imageAlt}
            className="w-full h-auto max-h-[min(420px,55vh)] object-cover object-center"
            decoding="async"
            loading="eager"
            src={imageUrl}
          />
        </div>
      ) : null}

      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground/90 mb-2">
        {title}
      </h1>

      {metaParts.length > 0 ? (
        <p className="text-sm font-mono text-foreground/45">
          {metaParts.join(" · ")}
        </p>
      ) : null}

      {locationLine && !startsAt ? (
        <p className="sr-only">
          {locationLabel}: {locationLine}
        </p>
      ) : null}
    </header>
  );
}

function EventAboutSection({
  summary,
  imageUrls,
  imageAlt,
}: {
  summary: string | null;
  imageUrls: string[];
  imageAlt: string;
}) {
  const summaryLine = summary?.trim();
  const gallery = imageUrls.length > 1 ? imageUrls.slice(1) : [];

  if (!summaryLine && gallery.length === 0) {
    return null;
  }

  return (
    <section className="mb-10 md:mb-12 max-w-2xl">
      {summaryLine ? (
        <p className="text-base text-foreground/50 leading-relaxed whitespace-pre-wrap">
          {summaryLine}
        </p>
      ) : null}
      {gallery.length > 0 ? (
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 gap-2 ${summaryLine ? "mt-6" : ""}`}
        >
          {gallery.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="border border-foreground/10 overflow-hidden aspect-4/3"
            >
              <img
                alt={`${imageAlt} (${i + 2})`}
                className="w-full h-full object-cover"
                decoding="async"
                loading="lazy"
                src={url}
              />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function buildHostInviteUrl(
  locale: string,
  slug: string,
  token: string,
): string {
  const url = new URL(`/${locale}/events/private`, getSiteOrigin());

  url.searchParams.set("slug", slug);
  url.searchParams.set("invite", token);

  return url.toString();
}

function HostInviteShareBlock({
  locale,
  slug,
  token,
  remaining,
  conversions,
  labels,
}: {
  locale: Locale;
  slug: string;
  token: string;
  remaining: number;
  conversions: InviteLinkConversion[];
  labels: {
    linkLabel: string;
    copy: string;
    copied: string;
    invitesLeft: string;
    conversionsTitle: string;
    conversionsEmpty: string;
  };
}) {
  const inviteUrl = useMemo(
    () => buildHostInviteUrl(locale, slug, token),
    [locale, slug, token],
  );
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-mono uppercase tracking-wider text-foreground/40">
        {labels.linkLabel}
      </p>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
        <div className="flex-1 min-w-0 border border-foreground/10 bg-foreground/[0.02] px-3 py-2.5">
          <p className="text-xs font-mono text-foreground/55 break-all leading-relaxed">
            {inviteUrl}
          </p>
        </div>
        <NeonButton
          aria-label={labels.copy}
          className="shrink-0 px-4 py-2.5 text-[10px] tracking-[0.15em]"
          type="button"
          onPress={() => void handleCopy()}
        >
          {copied ? labels.copied : labels.copy}
        </NeonButton>
      </div>
      <p className="text-sm font-mono text-neon/70">
        {labels.invitesLeft.replaceAll("{count}", String(remaining))}
      </p>

      <div className="pt-4 border-t border-foreground/10">
        <p className="text-xs font-mono uppercase tracking-wider text-foreground/40 mb-3">
          {labels.conversionsTitle}
        </p>
        {conversions.length === 0 ? (
          <p className="text-sm text-foreground/45">
            {labels.conversionsEmpty}
          </p>
        ) : (
          <ul className="space-y-2" data-testid="host-invite-conversions">
            {conversions.map((guest) => {
              const name = [guest.givenName, guest.familyName]
                .filter(Boolean)
                .join(" ");
              const dateLabel = formatLocaleDate(guest.registeredAt, locale);

              return (
                <li
                  key={guest.orderId}
                  data-testid={`host-invite-conversion-${guest.orderId}`}
                >
                  <p className="text-sm text-foreground/75">{name}</p>
                  <p className="text-xs font-mono text-foreground/40 mt-0.5">
                    {guest.tierName}
                    {dateLabel ? ` · ${dateLabel}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function PaymentStep({
  payLabel,
  onePersonHint,
  returnUrl,
  onPaymentSucceeded,
}: {
  payLabel: string;
  onePersonHint: string;
  returnUrl: string;
  onPaymentSucceeded: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    <form className="mt-6 space-y-4" onSubmit={handlePay}>
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

function EventDetailsInner({ slug }: { slug: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const {
    inviteToken: urlInviteToken,
    code: initialCode,
    promo,
  } = useEventUrlParams();
  const { appendToHref, returnPath: linkReturnPath } =
    usePersistedEventLinkQuery();
  const { dictionary } = useDictionary();
  const t = dictionary.events;
  const stripePromise = useStripePromise();

  const detailReturnPath = linkReturnPath(pathname);

  const { codeHandled, codeError } = useExchangeRegistrationCode({
    code: initialCode,
    sessionErrorLabel: t.sessionError,
    onInvalidated: async () => {
      await queryClient.invalidateQueries({
        queryKey: eventsKeys.detail(slug, urlInviteToken),
      });
      await queryClient.invalidateQueries({
        queryKey: eventsKeys.participant.profile(),
      });
    },
  });

  const eventDetailOptions = eventsApi.event.detail({
    slug,
    inviteToken: urlInviteToken,
    enabled: codeHandled,
  });

  const eventQuery = useQuery(eventDetailOptions);

  const effectiveInviteToken =
    eventQuery.data != null && !eventQuery.data.inviteOnly
      ? undefined
      : urlInviteToken;

  const profileLabels = useProfileModalLabels();
  const [profileGateOpen, setProfileGateOpen] = useState(true);
  const {
    profile,
    needsProfile,
    isLoading: profileLoading,
    invalidateAfterProfileComplete,
  } = useProfileBootstrap(effectiveInviteToken);

  useEffect(() => {
    if (!profileLoading && needsProfile) {
      setProfileGateOpen(true);
    }
  }, [profileLoading, needsProfile]);

  useEffect(() => {
    const ev = eventQuery.data;

    if (!ev || eventQuery.isLoading || !codeHandled) {
      return;
    }
    const accessDenied =
      ev.inviteOnly &&
      !ev.registrationConfirmed &&
      (ev.access === "minimal" || !ev.tiers || ev.tiers.length === 0);

    if (!accessDenied) {
      return;
    }
    router.replace(`/${locale}/events`);
  }, [
    appendToHref,
    codeHandled,
    eventQuery.data,
    eventQuery.isLoading,
    locale,
    router,
  ]);

  useEffect(() => {
    const ev = eventQuery.data;

    if (!ev || ev.inviteOnly || !urlInviteToken || !codeHandled) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());

    if (!params.has("invite")) {
      return;
    }
    params.delete("invite");
    const qs = params.toString();

    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    codeHandled,
    eventQuery.data,
    pathname,
    router,
    searchParams,
    urlInviteToken,
  ]);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedExclusiveId, setSelectedExclusiveId] = useState<string | null>(
    null,
  );
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [checkoutReturnUrl, setCheckoutReturnUrl] = useState<string | null>(
    null,
  );
  const [chargedTotalCents, setChargedTotalCents] = useState<number | null>(
    null,
  );
  const checkoutConfirmation = useCheckoutConfirmation({
    slug,
    inviteToken: effectiveInviteToken,
    errorLabels: {
      timeout: t.checkoutConfirmTimeout,
      generic: t.checkoutConfirmError,
    },
  });

  const exclusiveTiers = useMemo(
    () => (eventQuery.data?.tiers ?? []).filter(isExclusiveTier),
    [eventQuery.data?.tiers],
  );
  const addonTiers = useMemo(
    () => (eventQuery.data?.tiers ?? []).filter(isAddonTier),
    [eventQuery.data?.tiers],
  );

  useEffect(() => {
    const tiers = eventQuery.data?.tiers ?? [];
    const autoId = defaultExclusiveTierId(tiers);

    if (autoId) {
      setSelectedExclusiveId(autoId);

      return;
    }

    if (exclusiveTiers.length === 0) {
      setSelectedExclusiveId(null);

      return;
    }

    setSelectedExclusiveId((prev) => {
      if (prev && exclusiveTiers.some((tier) => tier.id === prev)) {
        return prev;
      }

      return null;
    });
  }, [eventQuery.data?.tiers, exclusiveTiers, slug]);

  useEffect(() => {
    const addonIds = new Set(addonTiers.map((tier) => tier.id));

    setSelectedAddonIds((prev) => {
      const next = new Set<string>();

      for (const id of Array.from(prev)) {
        if (addonIds.has(id)) {
          next.add(id);
        }
      }

      return next;
    });
  }, [addonTiers]);

  useEffect(() => {
    setChargedTotalCents(null);
  }, [selectedExclusiveId, selectedAddonIds, promo]);

  const selectedTiers = useMemo(() => {
    const tiers = eventQuery.data?.tiers ?? [];
    const ids = new Set<string>();

    if (selectedExclusiveId) {
      ids.add(selectedExclusiveId);
    }
    for (const id of Array.from(selectedAddonIds)) {
      ids.add(id);
    }

    return tiers.filter((tier) => ids.has(tier.id));
  }, [eventQuery.data?.tiers, selectedExclusiveId, selectedAddonIds]);

  const listTotalCents = useMemo(
    () => selectedTiers.reduce((sum, tier) => sum + tier.priceCents, 0),
    [selectedTiers],
  );

  const intentMutation = useMutation(eventsApi.checkout.intent());
  const checkoutLocked = Boolean(clientSecret) || intentMutation.isPending;

  const pricingPreviewQuery = useQuery(
    eventsApi.checkout.pricingPreview({
      slug,
      exclusiveTierId: selectedExclusiveId ?? "",
      addonTierIds: Array.from(selectedAddonIds),
      promotionCode: promo ?? null,
      enabled:
        codeHandled &&
        Boolean(promo?.trim()) &&
        selectedTiers.length > 0 &&
        !checkoutLocked,
    }),
  );

  const previewPricing = pricingPreviewQuery.data;
  const displayTotalCents =
    chargedTotalCents ?? previewPricing?.amountCents ?? listTotalCents;
  const showPromoSubtotal =
    previewPricing != null &&
    previewPricing.discountCents > 0 &&
    chargedTotalCents == null;

  const confirmingRegistration = checkoutConfirmation.isConfirming;
  const checkoutConfirmError = checkoutConfirmation.errorMessage;

  function startCheckoutAfterPayment(orderId: string): void {
    setClientSecret(null);
    setCheckoutOrderId(null);
    setCheckoutReturnUrl(null);
    checkoutConfirmation.startConfirmation(orderId);
  }

  useEffect(() => {
    if (!codeHandled) {
      return;
    }
    if (searchParams.get("redirect_status") !== "succeeded") {
      return;
    }
    const orderId = eventsApi.storage.takeCheckoutOrderId(slug);

    if (!orderId) {
      return;
    }
    startCheckoutAfterPayment(orderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per Stripe return
  }, [codeHandled, slug]);

  useEffect(() => {
    if (!codeHandled || confirmingRegistration) {
      return;
    }
    if (searchParams.get("redirect_status") !== "succeeded") {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());

    for (const key of [
      "payment_intent",
      "payment_intent_client_secret",
      "redirect_status",
    ]) {
      params.delete(key);
    }
    const qs = params.toString();

    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [codeHandled, confirmingRegistration, pathname, router, searchParams]);

  const returnUrl = useMemo(() => {
    const qs = searchParams.toString();

    return absoluteSiteUrl(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, searchParams]);

  const elementsOptions: StripeElementsOptions | undefined = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#FF3131",
            colorBackground: "#050505",
            colorText: "#f0f0f0",
            borderRadius: "2px",
          },
        },
      }
    : undefined;

  if (eventQuery.isLoading || !codeHandled) {
    return (
      <div className="flex justify-center py-16">
        <Spinner color="success" size="lg" />
      </div>
    );
  }

  if (codeError) {
    return <FormError>{codeError}</FormError>;
  }

  if (eventQuery.isError) {
    return <FormError>{t.loadError}</FormError>;
  }

  const ev = eventQuery.data as EventPayload;
  const registrationSettled =
    Boolean(ev.registrationConfirmed) && !confirmingRegistration;
  const hasCheckoutProfile = Boolean(profile?.profileComplete);
  const showProfileGateModal =
    profileGateOpen && needsProfile && !profileLoading;
  const showContactForm = !profileLoading && !hasCheckoutProfile;
  const checkoutContactReady = hasCheckoutProfile
    ? true
    : Boolean(email.trim() || phone.trim());

  const needsStripe = !ev.registrationConfirmed && Boolean(ev.tiers?.length);
  const requiresExclusive = exclusiveTiers.length > 0;
  const tierSelectionReady = requiresExclusive
    ? Boolean(selectedExclusiveId)
    : selectedAddonIds.size > 0;

  const checkoutDisabledReason = !tierSelectionReady
    ? t.checkoutSelectTier
    : profileLoading
      ? t.loading
      : !checkoutContactReady
        ? t.checkoutEnterContact
        : null;

  if (needsStripe && !stripePromise) {
    return (
      <p className="text-sm text-foreground/40 font-mono">
        {t.missingStripeKey}
      </p>
    );
  }

  const backHref = `/${locale}/events`;
  const heroImage = ev.imageUrls?.[0];

  return (
    <>
      {showProfileGateModal ? (
        <ParticipantProfileModal
          open
          dismissable={false}
          initialProfile={profile ?? undefined}
          labels={profileLabels}
          onComplete={async (p) => {
            writeParticipantProfileCache(queryClient, p, effectiveInviteToken);
            await invalidateAfterProfileComplete();
            setProfileGateOpen(false);
          }}
        />
      ) : null}
      <div
        className={
          showProfileGateModal
            ? "pointer-events-none opacity-40 select-none"
            : undefined
        }
      >
        <EventHero
          backHref={backHref}
          backLabel={t.backToEvents}
          imageAlt={t.detailImageAlt}
          imageUrl={heroImage}
          locale={locale}
          location={ev.location ?? null}
          locationLabel={t.detailLocation}
          startsAt={ev.startsAt}
          title={ev.title}
        />

        {registrationSettled ? (
          <Card
            className="mb-10 md:mb-12 border border-neon/30 bg-transparent max-w-xl"
            radius="sm"
          >
            <CardBody className="px-6 py-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground/90 mb-3">
                {t.registrationConfirmedTitle}
              </h2>
              {ev.registeredTiers && ev.registeredTiers.length > 0 ? (
                <RegistrationConfirmedSummary
                  eventStartsAt={ev.startsAt}
                  labels={{
                    addon: t.registrationConfirmedTierAddon,
                    bodyNoTier: t.registrationConfirmedBodyNoTier,
                    intro: t.registrationConfirmedIntro,
                    introNoName: t.registrationConfirmedIntroNoName,
                  }}
                  locale={locale}
                  tiers={ev.registeredTiers}
                  viewerGivenName={ev.viewerGivenName}
                />
              ) : ev.registeredTierName ? (
                <RegistrationConfirmedSummary
                  eventStartsAt={ev.startsAt}
                  labels={{
                    addon: t.registrationConfirmedTierAddon,
                    bodyNoTier: t.registrationConfirmedBodyNoTier,
                    intro: t.registrationConfirmedIntro,
                    introNoName: t.registrationConfirmedIntroNoName,
                  }}
                  locale={locale}
                  tiers={[
                    {
                      id: "legacy",
                      name: ev.registeredTierName,
                      description: "",
                      selectionMode: "exclusive",
                      priceCents: 0,
                      currency: "chf",
                    },
                  ]}
                  viewerGivenName={ev.viewerGivenName}
                />
              ) : (
                <p className="text-base text-neon/80 leading-relaxed">
                  {t.registrationConfirmedBodyNoTier}
                </p>
              )}
              {ev.inviteOnly && ev.hostInvite ? (
                <details open className="mt-6 group">
                  <summary className="cursor-pointer text-sm font-semibold text-foreground/70 list-none flex items-center gap-2">
                    <span className="group-open:rotate-90 transition-transform">
                      ›
                    </span>
                    {t.hostInviteGuestsTitle}
                  </summary>
                  <div className="mt-4 pl-4">
                    <HostInviteShareBlock
                      conversions={ev.hostInvite.conversions}
                      labels={{
                        copied: t.hostInviteCopied,
                        conversionsEmpty: t.hostInviteConversionsEmpty,
                        conversionsTitle: t.hostInviteConversionsTitle,
                        copy: t.hostInviteCopy,
                        invitesLeft: t.hostInvitesLeft,
                        linkLabel: t.hostInviteLinkLabel,
                      }}
                      locale={locale}
                      remaining={ev.hostInvite.remaining}
                      slug={slug}
                      token={ev.hostInvite.token}
                    />
                  </div>
                </details>
              ) : null}
            </CardBody>
          </Card>
        ) : null}

        {ev.inviteOnly && !ev.tiers && !ev.registrationConfirmed ? (
          <p className="text-base text-foreground/50 leading-relaxed max-w-2xl mb-10">
            {t.needInvite}
          </p>
        ) : null}

        {confirmingRegistration && !registrationSettled ? (
          <div className="flex flex-col items-center gap-4 py-12 mb-10 max-w-xl">
            <Spinner color="success" size="lg" />
            <p className="text-sm font-mono text-foreground/50 text-center">
              {t.checkoutConfirming}
            </p>
          </div>
        ) : null}

        {checkoutConfirmError &&
        !confirmingRegistration &&
        !registrationSettled ? (
          <FormError className="mb-10 max-w-xl">
            {checkoutConfirmError}
          </FormError>
        ) : null}

        {!ev.registrationConfirmed &&
        !confirmingRegistration &&
        ev.tiers &&
        ev.tiers.length > 0 ? (
          <Card
            className="mb-10 md:mb-12 border border-foreground/10 bg-foreground/[0.02] max-w-xl"
            data-testid={
              hasCheckoutProfile
                ? "event-checkout-minimal"
                : "event-checkout-with-contact"
            }
            radius="sm"
          >
            <CardBody className="px-6 py-8">
              <p className="text-xs font-mono text-foreground/40 mb-4">
                {clientSecret ? t.checkoutStepPay : t.checkoutStepChoose}
              </p>
              <h2
                className="text-xl font-bold tracking-tight text-foreground/90 mb-1"
                id="event-checkout-heading"
              >
                {t.contributionTitle}
              </h2>
              <p className="text-sm text-foreground/45 mb-6">
                {t.contributionSubtitle}
              </p>

              {exclusiveTiers.length > 0 ? (
                <RadioGroup
                  aria-labelledby="event-checkout-heading"
                  classNames={{ wrapper: "gap-6" }}
                  isDisabled={checkoutLocked}
                  value={selectedExclusiveId ?? ""}
                  onValueChange={setSelectedExclusiveId}
                >
                  {exclusiveTiers.map((tier) => {
                    const tierDescription = tier.description.trim();
                    const priceLabel = formatTierPrice(tier);
                    const placesLabel = formatPlacesRemaining(
                      tier,
                      t.placesRemaining,
                      t.placesUnlimited,
                    );

                    return (
                      <Radio
                        key={tier.id}
                        classNames={{
                          base: "max-w-full m-0 p-3 border border-foreground/10 data-[selected=true]:border-neon/40 rounded-sm",
                          wrapper: "mt-0.5",
                          label: "w-full max-w-full",
                          labelWrapper: "w-full max-w-full",
                          description:
                            "text-xs text-foreground/45 leading-relaxed mt-1.5",
                        }}
                        data-testid={`event-checkout-exclusive-${tier.id}`}
                        description={tierDescription || undefined}
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
                  <p className="text-xs font-mono uppercase tracking-wider text-foreground/40">
                    {t.addonsTitle}
                  </p>
                  <div className="space-y-3">
                    {addonTiers.map((tier) => {
                      const tierDescription = tier.description.trim();
                      const priceLabel = formatTierPrice(tier);
                      const placesLabel = formatPlacesRemaining(
                        tier,
                        t.placesRemaining,
                        t.placesUnlimited,
                      );
                      const isSelected = selectedAddonIds.has(tier.id);

                      return (
                        <div
                          key={tier.id}
                          className="p-3 border border-foreground/10 rounded-sm data-[selected=true]:border-neon/40"
                          data-selected={isSelected ? true : undefined}
                        >
                          <Checkbox
                            classNames={{
                              base: "max-w-full m-0 items-start",
                              label: "w-full max-w-full",
                            }}
                            data-testid={`event-checkout-addon-${tier.id}`}
                            isDisabled={checkoutLocked}
                            isSelected={isSelected}
                            onValueChange={(checked) => {
                              setSelectedAddonIds((prev) => {
                                const next = new Set(prev);

                                if (checked) {
                                  next.add(tier.id);
                                } else {
                                  next.delete(tier.id);
                                }

                                return next;
                              });
                            }}
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

              {selectedTiers.length > 0 ? (
                <div className="mt-6 space-y-1">
                  {promo ? (
                    <p className="text-xs font-mono uppercase tracking-wider text-foreground/40">
                      {t.promoCodeLabel}: {promo}
                    </p>
                  ) : null}
                  {showPromoSubtotal ? (
                    <p className="text-xs text-foreground/45 line-through">
                      {t.checkoutSubtotal}: CHF{" "}
                      {(previewPricing!.subtotalCents / 100).toFixed(0)}
                    </p>
                  ) : null}
                  <p className="text-sm font-mono text-foreground/55">
                    {t.checkoutTotal}: CHF {(displayTotalCents / 100).toFixed(0)}
                  </p>
                  {showPromoSubtotal ? (
                    <p className="text-xs text-neon/80">
                      {t.promoDiscount}: CHF{" "}
                      {(previewPricing!.discountCents / 100).toFixed(0)}
                    </p>
                  ) : null}
                  {promo && pricingPreviewQuery.isError ? (
                    <p className="text-xs text-red-400">{t.promoInvalid}</p>
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
                    label={t.email}
                    type="email"
                    value={email}
                    onValueChange={setEmail}
                  />
                  <NeonInput
                    label={t.phone}
                    type="tel"
                    value={phone}
                    onValueChange={setPhone}
                  />
                </div>
              ) : null}

              {!clientSecret ? (
                <div className="mt-6 space-y-2">
                  <NeonButton
                    className="w-full sm:w-auto"
                    isDisabled={
                      intentMutation.isPending ||
                      !tierSelectionReady ||
                      profileLoading ||
                      !checkoutContactReady
                    }
                    type="button"
                    onPress={() => {
                      const useProfileContact = Boolean(
                        profile?.profileComplete,
                      );
                      const profileEmail = profile?.email?.trim() ?? "";
                      const profilePhone = profile?.phoneE164?.trim() ?? "";

                      intentMutation.mutate(
                        {
                          slug,
                          email: useProfileContact
                            ? profileEmail || null
                            : email.trim()
                              ? email.trim()
                              : null,
                          locale,
                          phoneE164: useProfileContact
                            ? profilePhone || null
                            : phone.trim()
                              ? phone.trim()
                              : null,
                          inviteToken: effectiveInviteToken ?? null,
                          promotionCode: promo ?? null,
                          exclusiveTierId: selectedExclusiveId ?? "",
                          addonTierIds: Array.from(selectedAddonIds),
                          returnPath: detailReturnPath,
                        },
                        {
                          onSuccess: (data) => {
                            setChargedTotalCents(data.amountCents);
                            setCheckoutOrderId(data.orderId);
                            setCheckoutReturnUrl(data.returnUrl);
                            eventsApi.storage.stashCheckoutOrderId(
                              slug,
                              data.orderId,
                            );
                            if (data.requiresPayment) {
                              if (!data.clientSecret) {
                                return;
                              }
                              setClientSecret(data.clientSecret);

                              return;
                            }
                            startCheckoutAfterPayment(data.orderId);
                          },
                        },
                      );
                    }}
                  >
                    {intentMutation.isPending ? "…" : t.ctaIntent}
                  </NeonButton>
                  {checkoutDisabledReason &&
                  (intentMutation.isPending ||
                    !tierSelectionReady ||
                    profileLoading ||
                    !checkoutContactReady) ? (
                    <p className="text-xs text-foreground/40">
                      {checkoutDisabledReason}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {intentMutation.isError ? (
                <FormError className="mt-4">
                  {intentMutation.error instanceof AxiosError &&
                  intentMutation.error.response?.data &&
                  typeof (
                    intentMutation.error.response.data as { error?: string }
                  ).error === "string"
                    ? (intentMutation.error.response.data as { error: string })
                        .error
                    : t.intentError}
                </FormError>
              ) : null}

              {checkoutLocked && selectedTiers.length > 0 ? (
                <div className="mt-6 pt-6 border-t border-foreground/10">
                  <p className="text-xs font-mono uppercase tracking-wider text-foreground/40 mb-1">
                    {t.checkoutOrderSummary}
                  </p>
                  <ul className="text-sm font-medium text-foreground/80 mb-2 space-y-1">
                    {selectedTiers.map((tier) => (
                      <li key={tier.id}>
                        {tier.name} — {formatTierPrice(tier)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm font-mono text-foreground/55">
                    {t.checkoutTotal}: CHF{" "}
                    {(displayTotalCents / 100).toFixed(0)}
                  </p>
                </div>
              ) : null}

              {clientSecret &&
              checkoutOrderId &&
              stripePromise &&
              elementsOptions ? (
                <Elements
                  key={clientSecret}
                  options={elementsOptions}
                  stripe={stripePromise}
                >
                  <PaymentStep
                    onePersonHint={t.checkoutOnePersonHint}
                    payLabel={t.pay}
                    returnUrl={checkoutReturnUrl ?? returnUrl}
                    onPaymentSucceeded={() => {
                      if (checkoutOrderId) {
                        startCheckoutAfterPayment(checkoutOrderId);
                      }
                    }}
                  />
                </Elements>
              ) : null}

              {!hasCheckoutProfile ? (
                <div className="mt-8 pt-6 border-t border-foreground/10">
                  <ParticipantSessionPanel
                    embedded
                    codeExchangePending={!codeHandled}
                    returnPath={detailReturnPath}
                    sessionEstablishedQueryKeys={[
                      eventsKeys.detail(slug, effectiveInviteToken),
                    ]}
                  />
                </div>
              ) : null}
            </CardBody>
          </Card>
        ) : null}

        <EventAboutSection
          imageAlt={t.detailImageAlt}
          imageUrls={ev.imageUrls ?? []}
          summary={ev.summary ?? null}
        />
      </div>
    </>
  );
}

export function EventDetailsClient({ slug }: { slug: string }) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner color="success" size="lg" />
        </div>
      }
    >
      <EventDetailsInner slug={slug} />
    </Suspense>
  );
}
