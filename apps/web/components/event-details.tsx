"use client";

import type { StripeElementsOptions } from "@stripe/stripe-js";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import { Spinner } from "@heroui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PageSpinner } from "@/components/page-spinner";
import { ContributionPanel } from "@/components/event/contribution-panel";
import { EventAboutSection } from "@/components/event/event-about-section";
import { EventDetailLayout } from "@/components/event/event-detail-layout";
import { EventHero } from "@/components/event/event-hero";
import { InviteOnlyEmptyState } from "@/components/event/invite-only-empty-state";
import { RegistrationConfirmedCard } from "@/components/event/registration-confirmed-card";
import { StickyContributionBar } from "@/components/event/sticky-contribution-bar";
import { FormError } from "@/components/form-error";
import { ParticipantSessionPanel } from "@/components/participant-session-panel";
import { absoluteSiteUrl } from "@/helpers/site-url";
import { formatContributionCta } from "@/helpers/contribution-labels";
import {
  defaultExclusiveTierId,
  hasEventAboutContent,
  heroSummaryText,
  isAddonTier,
  isExclusiveTier,
} from "@/helpers/event-tier-utils";
import { buildReturnPath } from "@/helpers/event-link-query";
import { eventDetailPath } from "@/helpers/eventRoutes";
import {
  ParticipantProfileGateModal,
  useParticipantProfileGate,
} from "@/hooks/use-participant-profile-gate";
import { useDictionary } from "@/i18n/DictionaryContext";
import { useEventLinkState } from "@/hooks/use-event-link-state";
import { useLocale } from "@/hooks/use-locale";
import { useStripePromise } from "@/hooks/use-stripe-promise";
import {
  eventsApi,
  eventsKeys,
  useCheckoutConfirmation,
  useExchangeRegistrationCode,
  type EventPayload,
} from "@/hooks/use-events-api";

function EventDetailsInner({ slug }: { slug: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const {
    inviteToken: urlInviteToken,
    promo,
    code: initialCode,
    linkQuery,
  } = useEventLinkState();
  const { dictionary } = useDictionary();
  const t = dictionary.events;
  const nav = dictionary.nav;
  const stripePromise = useStripePromise();
  const signInSectionRef = useRef<HTMLDivElement>(null);
  const [signInExpanded, setSignInExpanded] = useState(false);

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

  const eventQuery = useQuery(
    eventsApi.event.detail({
      slug,
      inviteToken: urlInviteToken,
      enabled: codeHandled,
    }),
  );

  const detailReturnPath = useMemo(() => {
    const inviteOnly = eventQuery.data?.inviteOnly ?? true;

    return buildReturnPath(
      `/${locale}${eventDetailPath(slug, inviteOnly)}`,
      searchParams,
      linkQuery,
    );
  }, [eventQuery.data?.inviteOnly, locale, linkQuery, searchParams, slug]);

  const effectiveInviteToken =
    eventQuery.data != null && !eventQuery.data.inviteOnly
      ? undefined
      : urlInviteToken;

  const profileGate = useParticipantProfileGate(effectiveInviteToken);

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
        Boolean(promo?.trim()) && selectedTiers.length > 0 && !checkoutLocked,
    }),
  );

  const previewPricing = pricingPreviewQuery.data;
  const displayTotalCents =
    chargedTotalCents ?? previewPricing?.amountCents ?? listTotalCents;
  const showPromoSubtotal =
    previewPricing != null &&
    previewPricing.discountCents > 0 &&
    chargedTotalCents == null;
  const promoInvalid =
    Boolean(promo) &&
    (pricingPreviewQuery.isError ||
      (pricingPreviewQuery.isSuccess &&
        previewPricing != null &&
        previewPricing.discountCents === 0 &&
        previewPricing.subtotalCents > 0));

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

  const scrollToContribution = useCallback(() => {
    document
      .getElementById("event-contribution")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const focusSignIn = useCallback(() => {
    setSignInExpanded(true);
    signInSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const handleConfirmContribution = useCallback(() => {
    const useProfileContact = Boolean(profileGate.profile?.profileComplete);
    const profileEmail = profileGate.profile?.email?.trim() ?? "";
    const profilePhone = profileGate.profile?.phoneE164?.trim() ?? "";

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
          eventsApi.storage.stashCheckoutOrderId(slug, data.orderId);
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
  }, [
    detailReturnPath,
    effectiveInviteToken,
    email,
    intentMutation,
    locale,
    phone,
    profileGate.profile,
    promo,
    selectedAddonIds,
    selectedExclusiveId,
    slug,
  ]);

  const handleChangeLevel = useCallback(() => {
    setClientSecret(null);
    setCheckoutOrderId(null);
    setCheckoutReturnUrl(null);
    intentMutation.reset();
  }, [intentMutation]);

  if (eventQuery.isLoading || !codeHandled) {
    return <PageSpinner />;
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
  const hasCheckoutProfile = Boolean(profileGate.profile?.profileComplete);
  const showContactForm = !profileGate.profileLoading && !hasCheckoutProfile;
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
    : profileGate.profileLoading
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

  const accessDenied =
    ev.inviteOnly &&
    !ev.registrationConfirmed &&
    (ev.access === "minimal" || !ev.tiers || ev.tiers.length === 0);

  const showCheckout =
    !ev.registrationConfirmed &&
    !confirmingRegistration &&
    Boolean(ev.tiers?.length) &&
    !accessDenied;

  const backHref = `/${locale}/events`;
  const heroImage = ev.imageUrls?.[0];
  const donateHref = `/${locale}/donate`;
  const imageUrls = ev.imageUrls ?? [];
  const hasAboutContent = hasEventAboutContent(ev.summary ?? null, imageUrls);
  const heroSummary = heroSummaryText(ev.summary ?? null, hasAboutContent);

  const contributionLabels = {
    contributionTitle: t.contributionTitle,
    contributionSubtitle: t.contributionSubtitle,
    checkoutStepChoose: t.checkoutStepChoose,
    checkoutStepPay: t.checkoutStepPay,
    changeLevel: t.changeLevel,
    addonsTitle: t.addonsTitle,
    placesRemaining: t.placesRemaining,
    placesUnlimited: t.placesUnlimited,
    soldOut: t.soldOut,
    checkoutSelectTier: t.checkoutSelectTier,
    checkoutEnterContact: t.checkoutEnterContact,
    loading: t.loading,
    email: t.email,
    phone: t.phone,
    contactPrivacyHint: t.contactPrivacyHint,
    alreadyRegistered: t.alreadyRegistered,
    checkoutOnePersonHint: t.checkoutOnePersonHint,
    pay: t.pay,
    intentError: t.intentError,
    checkoutOrderSummary: t.checkoutOrderSummary,
    checkoutTotal: t.checkoutTotal,
    checkoutSubtotal: t.checkoutSubtotal,
    promoCodeLabel: t.promoCodeLabel,
    promoDiscount: t.promoDiscount,
    promoInvalid: t.promoInvalid,
    costTransparencyTitle: t.costTransparencyTitle,
    costTransparencyBullets: [
      t.costTransparencyBullet1,
      t.costTransparencyBullet2,
      t.costTransparencyBullet3,
    ],
    costTransparencyDisclaimer: t.costTransparencyDisclaimer,
    completeRegistration: t.completeRegistration,
    confirmContribution: t.confirmContribution,
    allTiersSoldOut: t.allTiersSoldOut,
  };

  const ctaLabel = formatContributionCta(displayTotalCents, {
    completeRegistration: t.completeRegistration,
    confirmContribution: t.confirmContribution,
  });

  const stickySummary =
    selectedTiers.length > 0
      ? `${t.checkoutTotal}: CHF ${(displayTotalCents / 100).toFixed(0)}`
      : t.contributionTitle;

  const welcomeLine = (() => {
    if (!hasCheckoutProfile) {
      return undefined;
    }
    const givenName = profileGate.profile?.givenName?.trim();

    return givenName
      ? t.sessionWelcomeBack.replaceAll("{name}", givenName)
      : t.sessionWelcomeBackNoName;
  })();

  const contributionPanel = showCheckout ? (
    <ContributionPanel
      addonTiers={addonTiers}
      checkoutContactReady={checkoutContactReady}
      checkoutDisabledReason={checkoutDisabledReason}
      checkoutLocked={checkoutLocked}
      checkoutOrderId={checkoutOrderId}
      checkoutReturnUrl={checkoutReturnUrl}
      clientSecret={clientSecret}
      codeHandled={codeHandled}
      displayTotalCents={displayTotalCents}
      elementsOptions={elementsOptions}
      email={email}
      exclusiveTiers={exclusiveTiers}
      hasCheckoutProfile={hasCheckoutProfile}
      intentMutationError={intentMutation.error}
      intentMutationPending={intentMutation.isPending}
      labels={contributionLabels}
      phone={phone}
      previewDiscountCents={previewPricing?.discountCents}
      previewSubtotalCents={previewPricing?.subtotalCents}
      profileLoading={profileGate.profileLoading}
      promo={promo}
      promoInvalid={promoInvalid}
      returnUrl={returnUrl}
      selectedAddonIds={selectedAddonIds}
      selectedExclusiveId={selectedExclusiveId}
      selectedTiers={selectedTiers}
      sessionQueryKeys={[eventsKeys.detail(slug, effectiveInviteToken)]}
      sessionReturnPath={detailReturnPath}
      showContactForm={showContactForm}
      showPromoSubtotal={showPromoSubtotal}
      signInExpanded={signInExpanded}
      signInSectionRef={signInSectionRef}
      stripePromise={stripePromise}
      tierSelectionReady={tierSelectionReady}
      welcomeLine={welcomeLine}
      onAddonChange={(tierId, checked) => {
        setSelectedAddonIds((prev) => {
          const next = new Set(prev);

          if (checked) {
            next.add(tierId);
          } else {
            next.delete(tierId);
          }

          return next;
        });
      }}
      onChangeLevel={handleChangeLevel}
      onConfirmContribution={handleConfirmContribution}
      onEmailChange={setEmail}
      onExclusiveChange={setSelectedExclusiveId}
      onPaymentSucceeded={() => {
        if (checkoutOrderId) {
          startCheckoutAfterPayment(checkoutOrderId);
        }
      }}
      onPhoneChange={setPhone}
      onSignInExpandedChange={setSignInExpanded}
    />
  ) : null;

  const sideBySideCheckout = Boolean(contributionPanel) && hasAboutContent;

  const eventHero = (
    <EventHero
      backHref={backHref}
      imageAlt={t.detailImageAlt}
      inviteOnly={ev.inviteOnly}
      labels={{
        backToEvents: t.backToEvents,
        contributionOpen: t.contributionOpen,
        costTransparencyDisclaimer: t.costTransparencyDisclaimer,
        detailLocation: t.detailLocation,
        eventPassed: t.eventPassed,
        galleryClose: t.galleryClose,
        heroContributionCta: t.heroContributionCta,
        inviteOnly: t.inviteOnly,
        viewFullPoster: t.viewFullPoster,
      }}
      locale={locale}
      location={ev.location ?? null}
      posterUrl={heroImage}
      showContributionAnchor={showCheckout && hasAboutContent}
      showTrustDisclaimer={!showCheckout}
      startsAt={ev.startsAt}
      summary={ev.summary ?? null}
      summaryText={heroSummary}
      title={ev.title}
      onContributionAnchorClick={scrollToContribution}
    />
  );

  return (
    <>
      <ParticipantProfileGateModal eventTitle={ev.title} gate={profileGate} />

      <EventDetailLayout
        aside={registrationSettled || accessDenied ? null : contributionPanel}
        header={
          <>
            {registrationSettled ? (
              <RegistrationConfirmedCard
                donateHref={donateHref}
                ev={ev}
                labels={{
                  addToCalendar: t.addToCalendar,
                  donateCta: nav.donate,
                  hostInviteConversionsEmpty: t.hostInviteConversionsEmpty,
                  hostInviteConversionsTitle: t.hostInviteConversionsTitle,
                  hostInviteCopied: t.hostInviteCopied,
                  hostInviteCopy: t.hostInviteCopy,
                  hostInviteGuestsTitle: t.hostInviteGuestsTitle,
                  hostInviteLinkLabel: t.hostInviteLinkLabel,
                  hostInviteShare: t.hostInviteShare,
                  hostInvitesLeft: t.hostInvitesLeft,
                  registrationConfirmedBodyNoTier:
                    t.registrationConfirmedBodyNoTier,
                  registrationConfirmedIntro: t.registrationConfirmedIntro,
                  registrationConfirmedIntroNoName:
                    t.registrationConfirmedIntroNoName,
                  registrationConfirmedTierAddon:
                    t.registrationConfirmedTierAddon,
                  registrationConfirmedTitle: t.registrationConfirmedTitle,
                  supportNeonBeyondEvent: t.supportNeonBeyondEvent,
                }}
                locale={locale}
                slug={slug}
              />
            ) : null}

            {accessDenied ? (
              <>
                <InviteOnlyEmptyState
                  backHref={backHref}
                  backLabel={t.backToEvents}
                  body={t.inviteOnlyEmptyBody}
                  signInCta={t.inviteOnlySignInCta}
                  title={t.inviteOnlyEmptyTitle}
                  onSignInClick={focusSignIn}
                />
                <div ref={signInSectionRef} className="mb-10 max-w-xl">
                  <ParticipantSessionPanel
                    embedded
                    codeExchangePending={!codeHandled}
                    returnPath={detailReturnPath}
                    sessionEstablishedQueryKeys={[
                      eventsKeys.detail(slug, effectiveInviteToken),
                    ]}
                  />
                </div>
              </>
            ) : null}

            {confirmingRegistration && !registrationSettled ? (
              <div className="flex flex-col items-center gap-4 py-12 mb-8 max-w-xl">
                <Spinner color="success" size="lg" />
                <p className="text-sm font-mono text-foreground/50 text-center">
                  {t.checkoutConfirming}
                </p>
                <p className="text-xs text-foreground/40 text-center max-w-sm">
                  {t.confirmingNextSteps}
                </p>
              </div>
            ) : null}

            {checkoutConfirmError &&
            !confirmingRegistration &&
            !registrationSettled ? (
              <FormError className="mb-8 max-w-xl">
                {checkoutConfirmError}
              </FormError>
            ) : null}

            {!sideBySideCheckout ? eventHero : null}
          </>
        }
        main={
          <EventAboutSection
            className="mb-10 md:mb-12"
            imageAlt={t.detailImageAlt}
            imageUrls={imageUrls}
            summary={ev.summary ?? null}
          />
        }
        mainLead={sideBySideCheckout ? eventHero : null}
        stickyBarPadding={
          showCheckout &&
          tierSelectionReady &&
          !clientSecret &&
          !profileGate.showProfileGateModal &&
          !confirmingRegistration
        }
        twoColumn={hasAboutContent}
      />

      {showCheckout &&
      tierSelectionReady &&
      !clientSecret &&
      !profileGate.showProfileGateModal &&
      !confirmingRegistration ? (
        <StickyContributionBar
          busy={intentMutation.isPending}
          ctaLabel={ctaLabel}
          disabled={
            intentMutation.isPending ||
            !tierSelectionReady ||
            profileGate.profileLoading ||
            !checkoutContactReady
          }
          summaryLabel={stickySummary}
          onPress={handleConfirmContribution}
        />
      ) : null}
    </>
  );
}

export function EventDetailsClient({ slug }: { slug: string }) {
  return (
    <Suspense fallback={<PageSpinner />}>
      <EventDetailsInner slug={slug} />
    </Suspense>
  );
}
