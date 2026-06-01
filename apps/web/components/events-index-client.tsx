"use client";

import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useMemo } from "react";
import { Suspense } from "react";

import { NeonButton } from "@/components/neon-button";
import { NeonCard, NeonCardBody } from "@/components/neon-card";
import { FormError } from "@/components/form-error";
import { PageHeader } from "@/components/page-header";
import { PageSpinner } from "@/components/page-spinner";
import { ResponsiveEventImage } from "@/components/responsive-event-image";
import {
  ParticipantProfileGateModal,
  useParticipantProfileGate,
} from "@/hooks/use-participant-profile-gate";
import { ParticipantSessionPanel } from "@/components/participant-session-panel";
import { useDictionary } from "@/i18n/DictionaryContext";
import { useEventLinkState } from "@/hooks/use-event-link-state";
import { useLocale } from "@/hooks/use-locale";
import {
  eventsApi,
  eventsKeys,
  useExchangeRegistrationCode,
  type EventCatalogItem,
} from "@/hooks/use-events-api";
import { formatLocaleDateTime } from "@/helpers/format-locale-datetime";
import { eventDetailHref } from "@/helpers/eventRoutes";
import { markdownPlainText } from "@/helpers/markdown-plain-text";

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

function EventsIndexInner() {
  const locale = useLocale();
  const {
    inviteToken,
    code,
    appendToHref,
    returnPath: eventReturnPath,
  } = useEventLinkState();
  const { dictionary } = useDictionary();
  const t = dictionary.events;
  const profileGate = useParticipantProfileGate(inviteToken);

  const { codeHandled, codeError } = useExchangeRegistrationCode({
    code,
    sessionErrorLabel: t.sessionError,
  });

  const listQuery = useQuery(
    eventsApi.catalog({
      inviteToken,
      enabled: codeHandled && !profileGate.profileLoading,
    }),
  );

  const sessionQuery = useQuery(
    eventsApi.participant.session({
      enabled:
        codeHandled && !profileGate.profileLoading && !profileGate.needsProfile,
    }),
  );

  const rows = useMemo(
    () => (listQuery.data ? filterUpcoming(listQuery.data) : []),
    [listQuery.data],
  );

  if (codeError) {
    return <FormError>{codeError}</FormError>;
  }

  const listLoading =
    !codeHandled || profileGate.profileLoading || listQuery.isLoading;
  const sessionEstablished = sessionQuery.data?.session === true;
  const sessionBlockLoading =
    !profileGate.needsProfile &&
    !profileGate.profileLoading &&
    codeHandled &&
    sessionQuery.isLoading;

  const welcomeLine = (() => {
    const givenName = sessionQuery.data?.givenName?.trim();

    return givenName
      ? t.sessionWelcomeBack.replaceAll("{name}", givenName)
      : t.sessionWelcomeBackNoName;
  })();

  return (
    <>
      <ParticipantProfileGateModal gate={profileGate} />

      <div className={profileGate.dimmedContentClassName}>
        <PageHeader
          showNeonLine
          subtitle={t.indexSubtitle}
          title={t.indexTitle}
        />

        {!profileGate.needsProfile && sessionBlockLoading ? (
          <PageSpinner className="py-4 mb-10 md:mb-12" size="md" />
        ) : null}

        {!profileGate.needsProfile &&
        !sessionBlockLoading &&
        sessionEstablished ? (
          <p
            className="mb-10 md:mb-12 text-base md:text-lg font-semibold text-foreground/90 tracking-tight"
            data-testid="events-index-welcome"
          >
            {welcomeLine}
          </p>
        ) : null}

        {!profileGate.needsProfile &&
        !sessionBlockLoading &&
        !sessionEstablished ? (
          <NeonCard className="mb-10 md:mb-12" surface="default">
            <NeonCardBody padding="session">
              <h2 className="neon-label mb-4 normal-case tracking-tight text-foreground/80">
                {t.sessionHeading}
              </h2>
              <ParticipantSessionPanel
                embedded
                codeExchangePending={!codeHandled}
                returnPath={eventReturnPath(`/${locale}/events`)}
                sessionEstablishedQueryKeys={[
                  eventsKeys.catalog(),
                  eventsKeys.participant.profile(),
                  eventsKeys.participant.session(),
                ]}
              />
            </NeonCardBody>
          </NeonCard>
        ) : null}

        <section aria-label={t.indexTitle}>
          {listLoading ? (
            <PageSpinner className="py-12" />
          ) : listQuery.isError ? (
            <FormError>{t.loadError}</FormError>
          ) : rows.length === 0 ? (
            <p className="neon-body text-foreground/40">{t.indexEmpty}</p>
          ) : (
            <ul className="space-y-6">
              {rows.map((ev) => {
                const thumb = ev.images[0];
                const summaryLine = ev.summary?.trim()
                  ? markdownPlainText(ev.summary)
                  : null;
                const locationLine = ev.location?.trim();
                const detailHref = appendToHref(
                  eventDetailHref(locale, ev.slug, ev.inviteOnly),
                );
                const dateLabel = ev.startsAt
                  ? formatLocaleDateTime(ev.startsAt, locale)
                  : t.indexDateTbd;
                const metaParts = [dateLabel, locationLine].filter(Boolean);
                const openLabel = ev.registrationConfirmed
                  ? t.indexManage
                  : t.indexOpen;

                return (
                  <li key={ev.slug}>
                    <NeonCard
                      className="hover:border-neon/20 transition-colors"
                      surface="default"
                    >
                      <NeonCardBody padding="none">
                        <div className="flex flex-col sm:flex-row">
                          {thumb ? (
                            <div className="shrink-0 w-full sm:w-40 aspect-video sm:aspect-auto sm:min-h-[7rem] border-b sm:border-b-0 sm:border-r border-foreground/10 overflow-hidden">
                              <ResponsiveEventImage
                                alt={t.detailImageAlt}
                                className="w-full h-full object-cover"
                                focal={thumb.focal}
                                loading="lazy"
                                sizes="(max-width: 640px) 100vw, 10rem"
                                url={thumb.url}
                              />
                            </div>
                          ) : null}
                          <div className="flex-1 min-w-0 p-8 flex flex-col gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h2 className="neon-title-card">{ev.title}</h2>
                                {ev.inviteOnly ? (
                                  <span className="neon-badge">
                                    {t.inviteOnly}
                                  </span>
                                ) : null}
                              </div>
                              {metaParts.length > 0 ? (
                                <p className="neon-meta">
                                  {metaParts.join(" · ")}
                                </p>
                              ) : null}
                              {summaryLine ? (
                                <p className="text-sm text-foreground/45 leading-relaxed line-clamp-1">
                                  {summaryLine}
                                </p>
                              ) : null}
                            </div>
                            <NeonButton
                              aria-label={`${openLabel}: ${ev.title}`}
                              as={NextLink}
                              className="w-full sm:w-auto sm:self-start"
                              href={detailHref}
                            >
                              {openLabel}
                            </NeonButton>
                          </div>
                        </div>
                      </NeonCardBody>
                    </NeonCard>
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

export function EventsIndexClient() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <EventsIndexInner />
    </Suspense>
  );
}
