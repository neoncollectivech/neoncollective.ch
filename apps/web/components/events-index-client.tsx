"use client";

import type { Locale } from "@/i18n/config";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Spinner } from "@heroui/react";

import { FormError } from "@/components/form-error";
import { NeonLink } from "@/components/neon-link";
import { ParticipantProfileModal } from "@/components/participant-profile-modal";
import { ParticipantSessionPanel } from "@/components/participant-session-panel";
import { useDictionary } from "@/i18n/DictionaryContext";
import { useExchangeRegistrationSessionCode } from "@/hooks/use-exchange-registration-session-code";
import { useParticipantProfileBootstrap } from "@/hooks/use-participant-profile";
import { fetchEventsCatalog, type EventCatalogItem } from "@/helpers/eventsApi";
import { eventDetailHref } from "@/helpers/eventRoutes";
import {
  eventsCatalogQueryKey,
  participantProfileQueryKey,
  participantSessionQueryKey,
} from "@/helpers/queryKeys";

function filterUpcoming(events: EventCatalogItem[]): EventCatalogItem[] {
  const now = Date.now();
  const upcoming = events.filter((e) => {
    if (!e.startsAt) {
      return true;
    }

    return Date.parse(e.startsAt) >= now;
  });

  upcoming.sort((a, b) => {
    const ta = a.startsAt ? Date.parse(a.startsAt) : Number.POSITIVE_INFINITY;
    const tb = b.startsAt ? Date.parse(b.startsAt) : Number.POSITIVE_INFINITY;

    return ta - tb;
  });

  return upcoming;
}

function formatEventDate(startsAt: string, locale: Locale): string {
  return new Date(startsAt).toLocaleString(
    locale === "de" ? "de-CH" : locale === "it" ? "it-CH" : "en-GB",
    { dateStyle: "medium", timeStyle: "short" },
  );
}

function EventsIndexInner({ locale }: { locale: Locale }) {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? undefined;
  const inviteToken = searchParams.get("invite") ?? undefined;
  const { dictionary } = useDictionary();
  const t = dictionary.events;
  const queryClient = useQueryClient();
  const [profileGateOpen, setProfileGateOpen] = useState(true);
  const [profileManageOpen, setProfileManageOpen] = useState(false);

  const {
    profile,
    inviteFlow,
    needsProfile,
    isLoading: profileLoading,
    invalidateAfterProfileComplete,
    refetchProfile,
  } = useParticipantProfileBootstrap(inviteToken);

  const { codeHandled, codeError } = useExchangeRegistrationSessionCode({
    code,
    queryKeysToInvalidate: [
      eventsCatalogQueryKey,
      participantSessionQueryKey,
      participantProfileQueryKey,
    ],
    sessionErrorLabel: t.sessionError,
  });

  useEffect(() => {
    if (!profileLoading && needsProfile && inviteFlow) {
      setProfileGateOpen(true);
    }
  }, [profileLoading, needsProfile, inviteFlow]);

  const listQuery = useQuery({
    queryKey: [...eventsCatalogQueryKey, inviteToken ?? ""],
    queryFn: () => fetchEventsCatalog({ inviteToken }),
    enabled: codeHandled && !profileLoading,
  });

  const rows = useMemo(
    () => (listQuery.data ? filterUpcoming(listQuery.data) : []),
    [listQuery.data],
  );

  const profileLabels = {
    title: t.profileModalTitle,
    subtitle: t.profileModalSubtitle,
    givenName: t.profileGivenName,
    familyName: t.profileFamilyName,
    email: t.email,
    phone: t.phone,
    phoneOptional: t.profilePhoneOptional,
    contactHint: t.profileContactHint,
    saveCta: t.profileSaveCta,
    verifyTitle: t.profileVerifyTitle,
    verifyEmailHint: t.profileVerifyEmailHint,
    verifyPhoneHint: t.profileVerifyPhoneHint,
    verifyCodeLabel: t.sessionCodeLabel,
    verifyCodePlaceholder: t.sessionCodePlaceholder,
    verifyCta: t.sessionCodeCta,
    resendCta: t.profileResendCta,
    errorGeneric: t.profileErrorGeneric,
  };

  if (codeError) {
    return <FormError>{codeError}</FormError>;
  }

  const showProfileGateModal =
    inviteFlow && profileGateOpen && needsProfile && !profileLoading;
  const showProfileManageModal = profileManageOpen && !profileLoading;
  const profileModalOpen = showProfileGateModal || showProfileManageModal;
  const manageProfileLabels = {
    ...profileLabels,
    title: t.profileManageTitle,
    subtitle: t.profileManageSubtitle,
  };

  const listLoading = !codeHandled || profileLoading || listQuery.isLoading;

  return (
    <>
      {profileModalOpen ? (
        <ParticipantProfileModal
          open
          dismissable={showProfileManageModal}
          initialProfile={profile}
          labels={showProfileManageModal ? manageProfileLabels : profileLabels}
          locale={locale}
          onComplete={async (p) => {
            queryClient.setQueryData(participantProfileQueryKey, p);
            await invalidateAfterProfileComplete();
            setProfileGateOpen(false);
            setProfileManageOpen(false);
          }}
          onDismiss={() => setProfileManageOpen(false)}
        />
      ) : null}

      <div
        className={
          showProfileGateModal
            ? "pointer-events-none opacity-40 select-none"
            : undefined
        }
      >
        <header className="mb-10 md:mb-12">
          <div className="neon-line w-12 mb-6" />

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground/90 mb-3">
            {t.indexTitle}
          </h1>

          <p className="text-base text-foreground/50 leading-relaxed max-w-2xl">
            {t.indexSubtitle}
          </p>
        </header>

        {!needsProfile ? (
          <Card
            className="mb-10 md:mb-12 border border-foreground/10 bg-transparent"
            radius="sm"
          >
            <CardBody className="px-6 py-6">
              <h2 className="text-sm font-semibold text-foreground/80 mb-4 tracking-tight">
                {t.sessionHeading}
              </h2>
              <ParticipantSessionPanel
                embedded
                codeExchangePending={!codeHandled}
                locale={locale}
                returnPath={`/${locale}/events`}
                sessionEstablishedQueryKeys={[
                  eventsCatalogQueryKey,
                  participantProfileQueryKey,
                ]}
                onManageProfile={async () => {
                  await refetchProfile();
                  setProfileManageOpen(true);
                }}
              />
            </CardBody>
          </Card>
        ) : null}

        <section aria-label={t.indexTitle}>
          {listLoading ? (
            <div className="flex justify-center py-12">
              <Spinner color="success" size="lg" />
            </div>
          ) : listQuery.isError ? (
            <FormError>{t.loadError}</FormError>
          ) : rows.length === 0 ? (
            <p className="text-base text-foreground/40 leading-relaxed">
              {t.indexEmpty}
            </p>
          ) : (
            <ul className="space-y-6">
              {rows.map((ev) => {
                const thumb = ev.imageUrls[0];
                const summaryLine = ev.summary?.trim();
                const locationLine = ev.location?.trim();
                const detailHref = ev.inviteOnly
                  ? `${eventDetailHref(locale, ev.slug, true)}${
                      inviteToken
                        ? `&invite=${encodeURIComponent(inviteToken)}`
                        : ""
                    }`
                  : eventDetailHref(locale, ev.slug, false);
                const dateLabel = ev.startsAt
                  ? formatEventDate(ev.startsAt, locale)
                  : t.indexDateTbd;
                const metaParts = [dateLabel, locationLine].filter(Boolean);

                return (
                  <li key={ev.slug}>
                    <Card
                      className="border border-foreground/10 bg-foreground/[0.02] hover:border-neon/20 transition-colors"
                      radius="sm"
                    >
                      <CardBody className="p-0">
                        <div className="flex flex-col sm:flex-row">
                          {thumb ? (
                            <div className="shrink-0 w-full sm:w-40 aspect-video sm:aspect-auto sm:min-h-[7rem] border-b sm:border-b-0 sm:border-r border-foreground/10 overflow-hidden">
                              <img
                                alt={t.detailImageAlt}
                                className="w-full h-full object-cover"
                                decoding="async"
                                loading="lazy"
                                src={thumb}
                              />
                            </div>
                          ) : null}
                          <div className="flex-1 min-w-0 p-5 flex flex-col gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h2 className="text-lg font-semibold text-foreground/90 tracking-tight">
                                  {ev.title}
                                </h2>
                                {ev.inviteOnly ? (
                                  <span className="inline-flex items-center rounded-sm border border-neon/30 bg-neon/5 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-neon/80">
                                    {t.inviteOnly}
                                  </span>
                                ) : null}
                              </div>
                              {metaParts.length > 0 ? (
                                <p className="text-sm font-mono text-foreground/45">
                                  {metaParts.join(" · ")}
                                </p>
                              ) : null}
                              {summaryLine ? (
                                <p className="text-sm text-foreground/45 leading-relaxed line-clamp-1">
                                  {summaryLine}
                                </p>
                              ) : null}
                            </div>
                            <NeonLink
                              aria-label={`${t.indexOpen}: ${ev.title}`}
                              className="w-full sm:w-auto sm:self-start"
                              href={detailHref}
                            >
                              {t.indexOpen}
                            </NeonLink>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export function EventsIndexClient({ locale }: { locale: Locale }) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner color="success" size="lg" />
        </div>
      }
    >
      <EventsIndexInner locale={locale} />
    </Suspense>
  );
}
