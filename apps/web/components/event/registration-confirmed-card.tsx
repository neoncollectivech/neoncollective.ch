"use client";

import type { Locale } from "@/i18n/config";
import type { EventPayload, RegisteredOrderTier } from "@/helpers/eventsApi";

import { pickLocalizedText } from "@neon/site-locales";

import { NeonCard, NeonCardBody } from "@/components/neon-card";
import { HostInvitePanel } from "@/components/event/host-invite-panel";
import { NeonLink } from "@/components/neon-link";
import { NeonTextButton } from "@/components/neon-text-button";
import { buildGoogleCalendarUrl } from "@/helpers/calendar-links";
import { formatLocaleDateTime } from "@/helpers/format-locale-datetime";

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
          const description = pickLocalizedText(tier.description, locale) ?? "";
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

type RegistrationConfirmedCardProps = {
  ev: EventPayload;
  slug: string;
  locale: Locale;
  donateHref: string;
  labels: {
    registrationConfirmedTitle: string;
    registrationConfirmedIntro: string;
    registrationConfirmedIntroNoName: string;
    registrationConfirmedBodyNoTier: string;
    registeredTierActivity: string;
    hostInviteGuestsTitle: string;
    hostInviteLinkLabel: string;
    hostInviteCopy: string;
    hostInviteCopied: string;
    hostInviteShare: string;
    hostInvitesLeft: string;
    hostInviteConversionsTitle: string;
    hostInviteConversionsEmpty: string;
    hostInviteRegenerate: string;
    addToCalendar: string;
    upsellScrollCta: string;
    supportNeonBeyondEvent: string;
    donateCta: string;
  };
  showUpsellCta?: boolean;
  onUpsellPress?: () => void;
};

export function RegistrationConfirmedCard({
  ev,
  slug,
  locale,
  donateHref,
  labels,
  showUpsellCta = false,
  onUpsellPress,
}: RegistrationConfirmedCardProps) {
  const calendarSummary =
    ev.summary == null ? null : pickLocalizedText(ev.summary, locale);
  const calendarUrl =
    ev.startsAt != null
      ? buildGoogleCalendarUrl({
          title: ev.title,
          startsAt: ev.startsAt,
          location: ev.location,
          summary: calendarSummary,
        })
      : "";
  const tierLabels = {
    addon: labels.registeredTierActivity,
    bodyNoTier: labels.registrationConfirmedBodyNoTier,
    intro: labels.registrationConfirmedIntro,
    introNoName: labels.registrationConfirmedIntroNoName,
  };

  const registeredTiers =
    ev.registeredTiers && ev.registeredTiers.length > 0
      ? ev.registeredTiers
      : ev.registeredTierName
        ? [
            {
              id: "legacy",
              name: ev.registeredTierName,
              description: {},
              selectionMode: "exclusive" as const,
              priceCents: 0,
              currency: "chf",
            },
          ]
        : [];

  return (
    <NeonCard className="mb-8 md:mb-10" surface="accent">
      <NeonCardBody>
        <h2 className="neon-title-section mb-3">
          {labels.registrationConfirmedTitle}
        </h2>

        {registeredTiers.length > 0 ? (
          <RegistrationConfirmedSummary
            eventStartsAt={ev.startsAt}
            labels={tierLabels}
            locale={locale}
            tiers={registeredTiers}
            viewerGivenName={ev.viewerGivenName}
          />
        ) : (
          <p className="text-base text-neon/80 leading-relaxed">
            {labels.registrationConfirmedBodyNoTier}
          </p>
        )}

        {showUpsellCta && onUpsellPress ? (
          <div className="mt-6">
            <NeonTextButton type="button" onClick={onUpsellPress}>
              {labels.upsellScrollCta}
            </NeonTextButton>
          </div>
        ) : null}

        {calendarUrl ? (
          <div className="mt-6">
            <a
              className="text-neon/80 hover:text-neon underline-offset-2 hover:underline font-mono text-xs uppercase tracking-wider"
              href={calendarUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {labels.addToCalendar}
            </a>
          </div>
        ) : null}

        {ev.inviteOnly && ev.hostInvite ? (
          <HostInvitePanel
            eventTitle={ev.title}
            hostInvite={ev.hostInvite}
            labels={{
              hostInviteConversionsEmpty: labels.hostInviteConversionsEmpty,
              hostInviteConversionsTitle: labels.hostInviteConversionsTitle,
              hostInviteCopied: labels.hostInviteCopied,
              hostInviteCopy: labels.hostInviteCopy,
              hostInviteGuestsTitle: labels.hostInviteGuestsTitle,
              hostInviteLinkLabel: labels.hostInviteLinkLabel,
              hostInviteRegenerate: labels.hostInviteRegenerate,
              hostInviteShare: labels.hostInviteShare,
              hostInvitesLeft: labels.hostInvitesLeft,
            }}
            locale={locale}
            slug={slug}
          />
        ) : null}

        <p className="mt-8 pt-6 border-t border-foreground/10 text-sm text-foreground/45 leading-relaxed">
          {labels.supportNeonBeyondEvent}{" "}
          <NeonLink href={donateHref} neonStyle="inline">
            {labels.donateCta}
          </NeonLink>
        </p>
      </NeonCardBody>
    </NeonCard>
  );
}
