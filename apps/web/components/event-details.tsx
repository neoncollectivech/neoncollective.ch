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
import { Radio, RadioGroup } from "@heroui/radio";
import { Spinner } from "@heroui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FormError } from "@/components/form-error";
import { NeonButton } from "@/components/neon-button";
import { NeonInput } from "@/components/neon-input";
import { NeonLink } from "@/components/neon-link";
import { ParticipantSessionPanel } from "@/components/participant-session-panel";
import { useDictionary } from "@/i18n/DictionaryContext";
import { useEventUrlParams } from "@/hooks/use-event-url-params";
import { useLocale } from "@/hooks/use-locale";
import { useStripePromise } from "@/hooks/use-stripe-promise";
import {
  eventsApi,
  eventsKeys,
  useExchangeRegistrationCode,
  type EventPayload,
  type EventTier,
  type InviteLinkConversion,
} from "@/hooks/use-events-api";
import { fetchEvent } from "@/helpers/eventsApi";
import {
  formatLocaleDate,
  formatLocaleDateTime,
} from "@/helpers/format-locale-datetime";

function formatTierPrice(tier: EventTier): string {
  return `${(tier.priceCents / 100).toFixed(0)} ${tier.currency.toUpperCase()}`;
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
  _slug: string,
  token: string,
): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const url = new URL(`/${locale}/events`, origin);

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
      window.setTimeout(() => setCopied(false), 2000);
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
          <ul className="space-y-2">
            {conversions.map((guest) => {
              const name = [guest.givenName, guest.familyName]
                .filter(Boolean)
                .join(" ");
              const dateLabel = formatLocaleDate(guest.registeredAt, locale);

              return (
                <li key={guest.orderId}>
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
  onPaymentSucceeded: () => Promise<void>;
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
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (error) {
      setBusy(false);
      setErr(error.message ?? "Payment failed.");

      return;
    }

    try {
      await onPaymentSucceeded();
    } catch (confirmErr) {
      setErr(
        confirmErr instanceof AxiosError &&
          typeof confirmErr.response?.data === "object" &&
          confirmErr.response.data &&
          "error" in confirmErr.response.data &&
          typeof (confirmErr.response.data as { error?: string }).error ===
            "string"
          ? (confirmErr.response.data as { error: string }).error
          : "Payment succeeded but registration could not be confirmed. Refresh the page.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handlePay}>
      <PaymentElement />
      <p className="text-xs text-foreground/40">{onePersonHint}</p>
      {err ? <FormError>{err}</FormError> : null}
      <NeonButton
        className="w-full sm:w-auto"
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
  const { inviteToken: urlInviteToken, code: initialCode } =
    useEventUrlParams();
  const { dictionary } = useDictionary();
  const t = dictionary.events;
  const stripePromise = useStripePromise();

  const detailReturnPath = useMemo(() => {
    const qs = searchParams.toString();

    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  const { codeHandled, codeError } = useExchangeRegistrationCode({
    code: initialCode,
    sessionErrorLabel: t.sessionError,
    onInvalidated: async () => {
      await queryClient.invalidateQueries({
        queryKey: eventsKeys.detail(slug, urlInviteToken),
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

  const showCheckout =
    Boolean(eventQuery.data?.tiers?.length) &&
    !eventQuery.data?.registrationConfirmed;
  const profileQuery = useQuery(
    eventsApi.participant.profileRead({
      enabled: codeHandled && showCheckout,
    }),
  );

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
    const path = `/${locale}/events`;
    const qs = effectiveInviteToken
      ? `?invite=${encodeURIComponent(effectiveInviteToken)}`
      : "";

    router.replace(`${path}${qs}`);
  }, [
    codeHandled,
    effectiveInviteToken,
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
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [confirmingRegistration, setConfirmingRegistration] = useState(false);

  useEffect(() => {
    const ev = eventQuery.data;

    if (!ev?.tiers?.length) {
      return;
    }
    setSelectedTierId((prev) => {
      if (prev && ev.tiers!.some((tier) => tier.id === prev)) {
        return prev;
      }
      if (ev.tiers!.length === 1) {
        return ev.tiers![0]!.id;
      }

      return null;
    });
  }, [eventQuery.data]);

  const intentMutation = useMutation(eventsApi.checkout.intent());
  const confirmCheckoutMutation = useMutation(eventsApi.checkout.confirm());

  async function syncEventRegistration(): Promise<EventPayload> {
    const retryMs = [0, 400, 800, 1200, 2000];
    let latest = eventQuery.data as EventPayload;

    for (const wait of retryMs) {
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      latest = await fetchEvent(slug, { inviteToken: effectiveInviteToken });
      queryClient.setQueryData(eventDetailOptions.queryKey, latest);
      if (latest.registrationConfirmed) {
        return latest;
      }
    }

    return latest;
  }

  async function finalizeCheckout(orderId: string): Promise<void> {
    setConfirmingRegistration(true);
    setClientSecret(null);
    setCheckoutOrderId(null);
    try {
      await confirmCheckoutMutation.mutateAsync(orderId);
      await syncEventRegistration();
    } finally {
      setConfirmingRegistration(false);
    }
  }

  useEffect(() => {
    if (!codeHandled) {
      return;
    }
    const redirectStatus = searchParams.get("redirect_status");

    if (redirectStatus !== "succeeded") {
      return;
    }
    const orderId = eventsApi.storage.takeCheckoutOrderId(slug);

    if (!orderId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await finalizeCheckout(orderId);
      } catch {
        /* user can refresh; webhook may still reconcile */
      }
      if (cancelled || typeof window === "undefined") {
        return;
      }
      const url = new URL(window.location.href);

      for (const key of [
        "payment_intent",
        "payment_intent_client_secret",
        "redirect_status",
      ]) {
        url.searchParams.delete(key);
      }
      router.replace(`${url.pathname}${url.search}`);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per Stripe return
  }, [codeHandled, slug]);

  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}${window.location.search}`
      : `/${locale}/events/${slug}`;

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
  const profileLoading = profileQuery.isLoading;
  const hasCheckoutProfile = Boolean(profileQuery.data?.profileComplete);
  const showContactForm = !profileLoading && !hasCheckoutProfile;
  const checkoutContactReady = hasCheckoutProfile
    ? true
    : Boolean(email.trim() || phone.trim());

  const needsStripe = !ev.registrationConfirmed && Boolean(ev.tiers?.length);
  const selectedTier =
    ev.tiers?.find((tier) => tier.id === selectedTierId) ?? null;

  const checkoutDisabledReason = !selectedTierId
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
  const confirmationBody = ev.registeredTierName
    ? (ev.viewerGivenName
        ? t.registrationConfirmedBody
        : t.registrationConfirmedBodyNoName
      )
        .replaceAll("{name}", ev.viewerGivenName ?? "")
        .replaceAll("{tier}", ev.registeredTierName)
    : t.registrationConfirmedBodyNoTier;

  return (
    <div>
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
            <p className="text-base text-neon/80 leading-relaxed">
              {confirmationBody}
            </p>
            {ev.inviteOnly && ev.hostInvite ? (
              <details className="mt-6 group">
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
        <div className="flex justify-center py-12 mb-10">
          <Spinner color="success" size="lg" />
        </div>
      ) : null}

      {!ev.registrationConfirmed &&
      !confirmingRegistration &&
      ev.tiers &&
      ev.tiers.length > 0 ? (
        <Card
          className="mb-10 md:mb-12 border border-foreground/10 bg-foreground/[0.02] max-w-xl"
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

            <RadioGroup
              aria-labelledby="event-checkout-heading"
              classNames={{ wrapper: "gap-6" }}
              isDisabled={Boolean(clientSecret)}
              value={selectedTierId ?? ""}
              onValueChange={setSelectedTierId}
            >
              {ev.tiers.map((tier) => {
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

            {showContactForm ? (
              <div className="mt-6 space-y-3">
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
                    !selectedTierId ||
                    profileLoading ||
                    !checkoutContactReady
                  }
                  type="button"
                  onPress={() => {
                    const profile = profileQuery.data;
                    const useProfileContact = Boolean(profile?.profileComplete);
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
                        tierId: selectedTierId!,
                      },
                      {
                        onSuccess: (data) => {
                          setClientSecret(data.clientSecret);
                          setCheckoutOrderId(data.orderId);
                          eventsApi.storage.stashCheckoutOrderId(
                            slug,
                            data.orderId,
                          );
                        },
                      },
                    );
                  }}
                >
                  {intentMutation.isPending ? "…" : t.ctaIntent}
                </NeonButton>
                {checkoutDisabledReason &&
                (intentMutation.isPending ||
                  !selectedTierId ||
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

            {clientSecret && selectedTier ? (
              <div className="mt-6 pt-6 border-t border-foreground/10">
                <p className="text-xs font-mono uppercase tracking-wider text-foreground/40 mb-1">
                  {t.checkoutOrderSummary}
                </p>
                <p className="text-sm font-medium text-foreground/80 mb-4">
                  {selectedTier.name} — {formatTierPrice(selectedTier)}
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
                  returnUrl={returnUrl}
                  onPaymentSucceeded={() => finalizeCheckout(checkoutOrderId)}
                />
              </Elements>
            ) : null}

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
          </CardBody>
        </Card>
      ) : null}

      <EventAboutSection
        imageAlt={t.detailImageAlt}
        imageUrls={ev.imageUrls ?? []}
        summary={ev.summary ?? null}
      />
    </div>
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
