"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Suspense } from "react";
import { Card, CardBody } from "@heroui/card";
import { Spinner } from "@heroui/react";

import { FormError } from "@/components/form-error";
import { ResponsiveEventImage } from "@/components/responsive-event-image";
import { NeonLink } from "@/components/neon-link";
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
        <header className="mb-10 md:mb-12">
          <div className="neon-line w-12 mb-6" />

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground/90 mb-3">
            {t.indexTitle}
          </h1>

          <p className="text-base text-foreground/50 leading-relaxed max-w-2xl">
            {t.indexSubtitle}
          </p>
        </header>

        {!profileGate.needsProfile && sessionBlockLoading ? (
          <div className="flex justify-center py-4 mb-10 md:mb-12">
            <Spinner color="success" size="md" />
          </div>
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
                returnPath={eventReturnPath(`/${locale}/events`)}
                sessionEstablishedQueryKeys={[
                  eventsKeys.catalog(),
                  eventsKeys.participant.profile(),
                  eventsKeys.participant.session(),
                ]}
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
                    <Card
                      className="border border-foreground/10 bg-foreground/[0.02] hover:border-neon/20 transition-colors"
                      radius="sm"
                    >
                      <CardBody className="p-0">
                        <div className="flex flex-col sm:flex-row">
                          {thumb ? (
                            <div className="shrink-0 w-full sm:w-40 aspect-video sm:aspect-auto sm:min-h-[7rem] border-b sm:border-b-0 sm:border-r border-foreground/10 overflow-hidden">
                              <ResponsiveEventImage
                                alt={t.detailImageAlt}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                sizes="(max-width: 640px) 100vw, 10rem"
                                url={thumb}
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
                              aria-label={`${openLabel}: ${ev.title}`}
                              className="w-full sm:w-auto sm:self-start"
                              href={detailHref}
                            >
                              {openLabel}
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

export function EventsIndexClient() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner color="success" size="lg" />
        </div>
      }
    >
      <EventsIndexInner />
    </Suspense>
  );
}
