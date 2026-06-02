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
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PageSpinner } from "@/components/page-spinner";
import { ContributionPanel } from "@/components/event/contribution-panel";
import { EventAboutSection } from "@/components/event/event-about-section";
import { EventDetailLayout } from "@/components/event/event-detail-layout";
import { EventHero } from "@/components/event/event-hero";
import { InviteOnlyGate } from "@/components/event/invite-only-gate";
import { RegistrationConfirmedCard } from "@/components/event/registration-confirmed-card";
import { RegistrationPendingPanel } from "@/components/event/registration-pending-panel";
import { StickyContributionBar } from "@/components/event/sticky-contribution-bar";
import { FormError } from "@/components/form-error";
import { absoluteSiteUrl } from "@/helpers/site-url";
import { formatPayShareCta } from "@/helpers/pay-share-cta";
import {
  defaultExclusiveTierId,
  hasEventAboutContent,
  heroSummaryDisplay,
  isAddonTier,
  isExclusiveTier,
} from "@/helpers/event-tier-utils";
import { buildReturnPath } from "@/helpers/event-link-query";
import { scrollContributionCardIntoView } from "@/helpers/scroll-contribution-card";
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

  const checkoutTiers = useMemo(() => {
    const ev = eventQuery.data;
    if (ev?.registrationConfirmed && ev.availableUpsellTiers?.length) {
      return ev.availableUpsellTiers;
    }
    return ev?.tiers ?? [];
  }, [eventQuery.data]);
  const exclusiveTiers = useMemo(
    () => checkoutTiers.filter(isExclusiveTier),
    [checkoutTiers],
  );
  const addonTiers = useMemo(
    () => checkoutTiers.filter(isAddonTier),
    [checkoutTiers],
  );

  useEffect(() => {
    const tiers = checkoutTiers;
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
  }, [checkoutTiers, exclusiveTiers, slug]);

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
    const tiers = checkoutTiers;
    const ids = new Set<string>();

    if (selectedExclusiveId) {
      ids.add(selectedExclusiveId);
    }
    for (const id of Array.from(selectedAddonIds)) {
      ids.add(id);
    }

    return tiers.filter((tier) => ids.has(tier.id));
  }, [checkoutTiers, selectedExclusiveId, selectedAddonIds]);

  const listTotalCents = useMemo(
    () => selectedTiers.reduce((sum, tier) => sum + tier.priceCents, 0),
    [selectedTiers],
  );

  const intentMutation = useMutation(eventsApi.checkout.intent());
  const checkoutLocked = Boolean(clientSecret) || intentMutation.isPending;

  const upsellOnlyCheckout =
    Boolean(eventQuery.data?.registrationConfirmed) &&
    Boolean(eventQuery.data?.availableUpsellTiers?.length);

  const pricingPreviewQuery = useQuery(
    eventsApi.checkout.pricingPreview({
      slug,
      exclusiveTierId: upsellOnlyCheckout ? "" : (selectedExclusiveId ?? ""),
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
    scrollContributionCardIntoView("event-contribution");
  }, []);

  const scrollToUpsellContribution = useCallback(() => {
    scrollContributionCardIntoView("event-upsell-contribution");
  }, []);

  const handleConfirmContribution = useCallback(() => {
    const useProfileContact = Boolean(profileGate.profile?.profileComplete);
    const profileEmail = profileGate.profile?.email?.trim() ?? "";
    const profilePhone = profileGate.profile?.phoneE164?.trim() ?? "";

    const upsellOnly =
      Boolean(eventQuery.data?.registrationConfirmed) &&
      Boolean(eventQuery.data?.availableUpsellTiers?.length);

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
        exclusiveTierId: upsellOnly ? "" : (selectedExclusiveId ?? ""),
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
    eventQuery.data?.availableUpsellTiers?.length,
    eventQuery.data?.registrationConfirmed,
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
  const hasUpsellOptions = Boolean(
    ev.registrationConfirmed && ev.availableUpsellTiers?.length,
  );

  const showInviteOnlyGate =
    ev.inviteOnly && ev.access === "minimal" && !registrationSettled;

  if (showInviteOnlyGate) {
    return (
      <>
        <ParticipantProfileGateModal eventTitle={ev.title} gate={profileGate} />
        <InviteOnlyGate
          backHref={`/${locale}/events`}
          backLabel={t.backToEvents}
          codeExchangePending={!codeHandled}
          eventTitle={ev.title}
          gateTitle={t.inviteOnlyEmptyTitle}
          needInviteCopy={t.needInvite}
          returnPath={detailReturnPath}
          sessionEstablishedQueryKeys={[
            eventsKeys.detail(slug, effectiveInviteToken),
          ]}
        />
      </>
    );
  }

  const hasCheckoutProfile = Boolean(profileGate.profile?.profileComplete);
  const showContactForm = !profileGate.profileLoading && !hasCheckoutProfile;
  const checkoutContactReady = hasCheckoutProfile
    ? true
    : Boolean(email.trim() || phone.trim());

  const needsStripe =
    (!ev.registrationConfirmed && Boolean(ev.tiers?.length)) || hasUpsellOptions;
  const requiresExclusive = exclusiveTiers.length > 0;
  const tierSelectionReady = requiresExclusive
    ? Boolean(selectedExclusiveId)
    : selectedAddonIds.size > 0;

  const checkoutSelectMessage =
    exclusiveTiers.length === 0 && addonTiers.length > 0
      ? t.checkoutSelectActivity
      : t.checkoutSelectPass;

  const checkoutDisabledReason = !tierSelectionReady
    ? checkoutSelectMessage
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
    (!ev.registrationConfirmed || hasUpsellOptions) &&
    !confirmingRegistration &&
    Boolean(checkoutTiers.length) &&
    !accessDenied;
  const showActiveCheckout =
    showCheckout && (!registrationSettled || hasUpsellOptions);

  const backHref = `/${locale}/events`;
  const images = ev.images ?? [];
  const heroImage = images[0]?.url;
  const donateHref = `/${locale}/donate`;
  const hasAboutContent = hasEventAboutContent(ev.summary ?? null, images);
  const heroSummary = heroSummaryDisplay(ev.summary ?? null, hasAboutContent);

  const checkoutPanelTitle = hasUpsellOptions
    ? t.upsellPanelTitle
    : t.registerTitle;
  const checkoutPanelSubtitle = hasUpsellOptions
    ? t.upsellPanelSubtitle
    : t.registerSubtitle;

  const checkoutLabels = {
    registerTitle: checkoutPanelTitle,
    registerSubtitle: checkoutPanelSubtitle,
    passTitle: t.passTitle,
    checkoutStepChoose: t.checkoutStepChoose,
    checkoutStepPay: t.checkoutStepPay,
    checkoutStepConfirm: t.checkoutStepConfirm,
    changePass: t.changePass,
    activitiesTitle: t.activitiesTitle,
    activitiesHint: t.activitiesHint,
    placesRemaining: t.placesRemaining,
    placesUnlimited: t.placesUnlimited,
    soldOut: t.soldOut,
    checkoutEnterContact: t.checkoutEnterContact,
    loading: t.loading,
    email: t.email,
    phone: t.phone,
    contactPrivacyHint: t.contactPrivacyHint,
    alreadyRegistered: t.alreadyRegistered,
    checkoutOnePersonHint: t.checkoutOnePersonHint,
    payYourShareButton: t.payYourShareButton,
    intentError: t.intentError,
    checkoutYourShare: t.checkoutYourShare,
    checkoutSubtotal: t.checkoutSubtotal,
    promoCodeLabel: t.promoCodeLabel,
    promoDiscount: t.promoDiscount,
    promoInvalid: t.promoInvalid,
    completeRegistration: t.completeRegistration,
    payYourShare: t.payYourShare,
    allPassesSoldOut: t.allPassesSoldOut,
  };

  const ctaLabel = formatPayShareCta(displayTotalCents, {
    completeRegistration: t.completeRegistration,
    payYourShare: t.payYourShare,
  });

  const stickySummary =
    selectedTiers.length > 0
      ? `${t.checkoutYourShare}: CHF ${(displayTotalCents / 100).toFixed(0)}`
      : checkoutPanelTitle;

  const pendingPanelLabels = {
    checkoutStepChoose: t.checkoutStepChoose,
    checkoutStepPay: t.checkoutStepPay,
    checkoutStepConfirm: t.checkoutStepConfirm,
    checkoutPaymentReceived: t.checkoutPaymentReceived,
    checkoutConfirming: t.checkoutConfirming,
    confirmingNextSteps: t.confirmingNextSteps,
    checkoutYourShare: t.checkoutYourShare,
    checkoutSubtotal: t.checkoutSubtotal,
    promoCodeLabel: t.promoCodeLabel,
    promoDiscount: t.promoDiscount,
    promoInvalid: t.promoInvalid,
  };

  const checkoutEligible =
    !registrationSettled && !accessDenied && Boolean(ev.tiers?.length);

  const showPendingAside =
    confirmingRegistration ||
    Boolean(checkoutConfirmError && !registrationSettled);

  const contributionPanelProps = {
    addonTiers,
    checkoutContactReady,
    checkoutDisabledReason,
    checkoutLocked,
    checkoutOrderId,
    checkoutReturnUrl,
    clientSecret,
    codeHandled,
    displayTotalCents,
    elementsOptions,
    email,
    exclusiveTiers,
    hasCheckoutProfile,
    intentMutationError: intentMutation.error,
    intentMutationPending: intentMutation.isPending,
    labels: checkoutLabels,
    phone,
    previewDiscountCents: previewPricing?.discountCents,
    previewSubtotalCents: previewPricing?.subtotalCents,
    profileLoading: profileGate.profileLoading,
    promo,
    promoInvalid,
    returnUrl,
    selectedAddonIds,
    selectedExclusiveId,
    selectedTiers,
    sessionQueryKeys: [eventsKeys.detail(slug, effectiveInviteToken)],
    sessionReturnPath: detailReturnPath,
    showContactForm,
    showPromoSubtotal,
    signInExpanded,
    signInSectionRef,
    stripePromise,
    tierSelectionReady,
    onAddonChange: (tierId: string, checked: boolean) => {
      setSelectedAddonIds((prev) => {
        const next = new Set(prev);

        if (checked) {
          next.add(tierId);
        } else {
          next.delete(tierId);
        }

        return next;
      });
    },
    onChangeLevel: handleChangeLevel,
    onConfirmContribution: handleConfirmContribution,
    onEmailChange: setEmail,
    onExclusiveChange: setSelectedExclusiveId,
    onPaymentSucceeded: () => {
      if (checkoutOrderId) {
        startCheckoutAfterPayment(checkoutOrderId);
      }
    },
    onPhoneChange: setPhone,
    onSignInExpandedChange: setSignInExpanded,
  };

  const contributionPanel =
    showCheckout && !registrationSettled ? (
      <ContributionPanel id="event-contribution" {...contributionPanelProps} />
    ) : null;

  const upsellContributionPanel =
    showCheckout && registrationSettled && hasUpsellOptions ? (
      <ContributionPanel
        id="event-upsell-contribution"
        {...contributionPanelProps}
      />
    ) : null;

  const checkoutAside = !checkoutEligible ? null : showPendingAside ? (
    <RegistrationPendingPanel
      displayTotalCents={displayTotalCents}
      errorMessage={checkoutConfirmError}
      labels={pendingPanelLabels}
      previewDiscountCents={previewPricing?.discountCents}
      previewSubtotalCents={previewPricing?.subtotalCents}
      promo={promo}
      promoInvalid={promoInvalid}
      selectedTiers={selectedTiers}
      showPromoSubtotal={showPromoSubtotal}
    />
  ) : (
    contributionPanel
  );

  const showUpsellPanel =
    showCheckout && registrationSettled && hasUpsellOptions;

  const sideBySideCheckout = Boolean(checkoutAside) && hasAboutContent;
  const sideBySideUpsell = Boolean(showUpsellPanel && hasAboutContent);
  const sideBySideLayout = sideBySideCheckout || sideBySideUpsell;

  const eventHero = (
    <EventHero
      backHref={backHref}
      imageAlt={t.detailImageAlt}
      inviteOnly={ev.inviteOnly}
      labels={{
        backToEvents: t.backToEvents,
        registrationOpen: t.registrationOpen,
        sharedCostsDisclaimer: t.sharedCostsDisclaimer,
        detailLocation: t.detailLocation,
        eventPassed: t.eventPassed,
        galleryClose: t.galleryClose,
        heroRegisterCta: t.heroRegisterCta,
        inviteOnly: t.inviteOnly,
        viewFullPoster: t.viewFullPoster,
      }}
      locale={locale}
      location={ev.location ?? null}
      posterUrl={heroImage}
      showContributionAnchor={showActiveCheckout && hasAboutContent}
      showTrustDisclaimer={!showActiveCheckout}
      startsAt={ev.startsAt}
      summary={ev.summary ?? null}
      summaryDisplay={heroSummary}
      title={ev.title}
      onContributionAnchorClick={
        registrationSettled && hasUpsellOptions
          ? scrollToUpsellContribution
          : scrollToContribution
      }
    />
  );

  const eventAboutSection = (
    <EventAboutSection
      className="mb-10 md:mb-12"
      imageAlt={t.detailImageAlt}
      images={images}
      summary={ev.summary ?? null}
    />
  );

  const registrationConfirmedCard = registrationSettled ? (
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
        registrationConfirmedBodyNoTier: t.registrationConfirmedBodyNoTier,
        registrationConfirmedIntro: t.registrationConfirmedIntro,
        registrationConfirmedIntroNoName: t.registrationConfirmedIntroNoName,
        registeredTierActivity: t.registeredTierActivity,
        registrationConfirmedTitle: t.registrationConfirmedTitle,
        upsellScrollCta: t.upsellScrollCta,
        supportNeonBeyondEvent: t.supportNeonBeyondEvent,
      }}
      locale={locale}
      slug={slug}
      showUpsellCta={hasUpsellOptions}
      onUpsellPress={scrollToUpsellContribution}
    />
  ) : null;

  return (
    <>
      <ParticipantProfileGateModal eventTitle={ev.title} gate={profileGate} />

      <EventDetailLayout
        aside={sideBySideUpsell ? upsellContributionPanel : checkoutAside}
        header={!sideBySideLayout ? eventHero : null}
        main={
          sideBySideUpsell ? null : (
            <>
              {registrationConfirmedCard}
              {showUpsellPanel && !hasAboutContent
                ? upsellContributionPanel
                : null}
              {eventAboutSection}
            </>
          )
        }
        mainAfterAside={sideBySideUpsell ? eventAboutSection : null}
        mainBeforeAside={
          sideBySideUpsell ? registrationConfirmedCard : null
        }
        mainLead={sideBySideLayout ? eventHero : null}
        stickyBarPadding={
          showActiveCheckout &&
          tierSelectionReady &&
          !clientSecret &&
          !profileGate.showProfileGateModal &&
          !confirmingRegistration
        }
        twoColumn={hasAboutContent}
      />

      {showActiveCheckout &&
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
