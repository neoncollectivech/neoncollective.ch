"use client";

import type { Locale } from "@/i18n/config";

import clsx from "clsx";

import { EventPosterHero } from "@/components/event/event-poster-hero";
import { NeonLink } from "@/components/neon-link";
import { buildMapsUrl } from "@/helpers/maps-link";
import { eventRegistrationStatus } from "@/helpers/event-tier-utils";
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
    contributionOpen: string;
    eventPassed: string;
    costTransparencyDisclaimer: string;
    viewFullPoster: string;
    galleryClose: string;
    openInMaps: string;
    heroContributionCta: string;
  };
  showContributionAnchor?: boolean;
  onContributionAnchorClick?: () => void;
  /** Omit when checkout panel already shows cost transparency copy. */
  showTrustDisclaimer?: boolean;
  summaryText?: string | null;
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
  summaryText,
}: EventHeroProps) {
  const locationLine = location?.trim();
  const status = eventRegistrationStatus(startsAt);
  const summaryLine =
    summaryText !== undefined ? summaryText : summary?.trim() || null;
  const mapsUrl = locationLine ? buildMapsUrl(locationLine) : "";

  return (
    <header className="mb-8 md:mb-10">
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
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground/90">
              {title}
            </h1>
            {inviteOnly ? (
              <span className="inline-flex items-center rounded-sm border border-neon/30 bg-neon/5 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-neon/80">
                {labels.inviteOnly}
              </span>
            ) : null}
          </div>

          {startsAt ? (
            <p className="text-sm font-mono text-foreground/45">
              {formatLocaleDateTime(startsAt, locale)}
            </p>
          ) : null}

          {locationLine ? (
            <p className="text-sm font-mono text-foreground/45 mt-1">
              {locationLine}
              {mapsUrl ? (
                <>
                  {" · "}
                  <a
                    className="text-neon/80 hover:text-neon underline-offset-2 hover:underline"
                    href={mapsUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {labels.openInMaps}
                  </a>
                </>
              ) : null}
            </p>
          ) : null}

          {locationLine && !startsAt ? (
            <p className="sr-only">
              {labels.detailLocation}: {locationLine}
            </p>
          ) : null}

          {status === "open" ? (
            <p className="text-xs font-mono uppercase tracking-wider text-neon/70 mt-2">
              {labels.contributionOpen}
            </p>
          ) : status === "passed" ? (
            <p className="text-xs font-mono uppercase tracking-wider text-foreground/40 mt-2">
              {labels.eventPassed}
            </p>
          ) : null}

          {summaryLine ? (
            <p className="text-base text-foreground/50 leading-relaxed mt-4">
              {summaryLine}
            </p>
          ) : null}

          {showTrustDisclaimer ? (
            <p className="text-sm text-foreground/45 leading-relaxed mt-3">
              {labels.costTransparencyDisclaimer}
            </p>
          ) : null}

          {showContributionAnchor && onContributionAnchorClick ? (
            <button
              className="mt-4 text-sm font-semibold text-neon/80 hover:text-neon lg:hidden"
              type="button"
              onClick={onContributionAnchorClick}
            >
              {labels.heroContributionCta} →
            </button>
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
