"use client";

import type { Locale } from "@/i18n/config";

import clsx from "clsx";

import { EventPosterHero } from "@/components/event/event-poster-hero";
import { Markdown } from "@/components/markdown";
import { NeonLink } from "@/components/neon-link";
import { NeonTextButton } from "@/components/neon-text-button";
import {
  eventRegistrationStatus,
  type HeroSummaryDisplay,
} from "@/helpers/event-tier-utils";
import { formatLocaleDateTime } from "@/helpers/format-locale-datetime";

type EventHeroProps = {
  title: string;
  startsAt: string | null;
  location: string | null;
  summary: string | null;
  inviteOnly: boolean;
  posterUrl: string | undefined;
  imageAlt: string;
  locale: Locale;
  backHref: string;
  labels: {
    backToEvents: string;
    detailLocation: string;
    inviteOnly: string;
    registrationOpen: string;
    eventPassed: string;
    sharedCostsDisclaimer: string;
    viewFullPoster: string;
    galleryClose: string;
    heroRegisterCta: string;
  };
  showContributionAnchor?: boolean;
  onContributionAnchorClick?: () => void;
  /** Omit when checkout panel already shows cost transparency copy. */
  showTrustDisclaimer?: boolean;
  /** When set, overrides default summary rendering from `summary`. */
  summaryDisplay?: HeroSummaryDisplay | null;
};

export function EventHero({
  title,
  startsAt,
  location,
  summary,
  inviteOnly,
  posterUrl,
  imageAlt,
  locale,
  backHref,
  labels,
  showContributionAnchor,
  onContributionAnchorClick,
  showTrustDisclaimer = true,
  summaryDisplay,
}: EventHeroProps) {
  const locationLine = location?.trim();
  const status = eventRegistrationStatus(startsAt);
  const resolvedSummaryDisplay: HeroSummaryDisplay | null =
    summaryDisplay !== undefined
      ? summaryDisplay
      : summary?.trim()
        ? { text: summary.trim(), format: "markdown" }
        : null;

  return (
    <header className="mb-10 md:mb-12">
      <div className="neon-line w-12 mb-6" />

      <NeonLink
        className="text-sm text-foreground/45 mb-6 inline-block"
        href={backHref}
        neonStyle="inline"
      >
        ← {labels.backToEvents}
      </NeonLink>

      <div
        className={clsx(
          posterUrl ? "lg:flex lg:gap-8 lg:items-start" : undefined,
        )}
      >
        <div className={clsx(posterUrl ? "lg:flex-1 min-w-0" : undefined)}>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1 className="neon-title-page">{title}</h1>
            {inviteOnly ? (
              <span className="neon-badge">{labels.inviteOnly}</span>
            ) : null}
          </div>

          {startsAt ? (
            <p className="neon-meta">
              {formatLocaleDateTime(startsAt, locale)}
            </p>
          ) : null}

          {locationLine ? (
            <p className="neon-meta mt-1">{locationLine}</p>
          ) : null}

          {locationLine && !startsAt ? (
            <p className="sr-only">
              {labels.detailLocation}: {locationLine}
            </p>
          ) : null}

          {status === "open" ? (
            <p className="neon-label text-neon/70 mt-2 normal-case">
              {labels.registrationOpen}
            </p>
          ) : status === "passed" ? (
            <p className="neon-label mt-2 normal-case text-foreground/40">
              {labels.eventPassed}
            </p>
          ) : null}

          {resolvedSummaryDisplay ? (
            resolvedSummaryDisplay.format === "markdown" ? (
              <div className="neon-body mt-4">
                <Markdown content={resolvedSummaryDisplay.text} />
              </div>
            ) : (
              <p className="neon-body mt-4">{resolvedSummaryDisplay.text}</p>
            )
          ) : null}

          {showTrustDisclaimer ? (
            <p className="text-sm text-foreground/45 leading-relaxed mt-3">
              {labels.sharedCostsDisclaimer}
            </p>
          ) : null}

          {showContributionAnchor && onContributionAnchorClick ? (
            <NeonTextButton
              showArrow
              className="mt-4 lg:hidden"
              onClick={onContributionAnchorClick}
            >
              {labels.heroRegisterCta}
            </NeonTextButton>
          ) : null}
        </div>

        {posterUrl ? (
          <div className="mt-6 lg:mt-0 lg:shrink-0">
            <EventPosterHero
              alt={imageAlt}
              lightboxCloseLabel={labels.galleryClose}
              url={posterUrl}
              viewFullPosterLabel={labels.viewFullPoster}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}
