"use client";

import type { Locale } from "@/i18n/config";
import type { EventPayload, RegisteredOrderTier } from "@/helpers/eventsApi";

import { NeonCard, NeonCardBody } from "@/components/neon-card";
import { HostInviteShareBlock } from "@/components/event/host-invite-share-block";
import { NeonLink } from "@/components/neon-link";
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
    registrationConfirmedTierAddon: string;
    hostInviteGuestsTitle: string;
    hostInviteLinkLabel: string;
    hostInviteCopy: string;
    hostInviteCopied: string;
    hostInviteShare: string;
    hostInvitesLeft: string;
    hostInviteConversionsTitle: string;
    hostInviteConversionsEmpty: string;
    addToCalendar: string;
    supportNeonBeyondEvent: string;
    donateCta: string;
  };
};

export function RegistrationConfirmedCard({
  ev,
  slug,
  locale,
  donateHref,
  labels,
}: RegistrationConfirmedCardProps) {
  const calendarUrl =
    ev.startsAt != null
      ? buildGoogleCalendarUrl({
          title: ev.title,
          startsAt: ev.startsAt,
          location: ev.location,
          summary: ev.summary,
        })
      : "";
  const tierLabels = {
    addon: labels.registrationConfirmedTierAddon,
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
              description: "",
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
          <div className="mt-8 pt-6 border-t border-foreground/10">
            <h3 className="neon-title-card mb-4 text-foreground/70">
              {labels.hostInviteGuestsTitle}
            </h3>
            <HostInviteShareBlock
              conversions={ev.hostInvite.conversions}
              eventTitle={ev.title}
              labels={{
                copied: labels.hostInviteCopied,
                conversionsEmpty: labels.hostInviteConversionsEmpty,
                conversionsTitle: labels.hostInviteConversionsTitle,
                copy: labels.hostInviteCopy,
                invitesLeft: labels.hostInvitesLeft,
                linkLabel: labels.hostInviteLinkLabel,
                share: labels.hostInviteShare,
              }}
              locale={locale}
              remaining={ev.hostInvite.remaining}
              slug={slug}
              token={ev.hostInvite.token}
            />
          </div>
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
