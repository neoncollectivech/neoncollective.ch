"use client";

import type { Locale } from "@/i18n/config";
import type { InviteLinkConversion } from "@/helpers/eventsApi";

import { useMemo, useState } from "react";

import { NeonButton } from "@/components/neon-button";
import { getSiteOrigin } from "@/helpers/site-url";
import { formatLocaleDate } from "@/helpers/format-locale-datetime";

function buildHostInviteUrl(
  locale: string,
  slug: string,
  token: string,
): string {
  const url = new URL(`/${locale}/events/private`, getSiteOrigin());

  url.searchParams.set("slug", slug);
  url.searchParams.set("invite", token);

  return url.toString();
}

type HostInviteShareBlockProps = {
  locale: Locale;
  slug: string;
  token: string;
  remaining: number;
  conversions: InviteLinkConversion[];
  eventTitle: string;
  labels: {
    linkLabel: string;
    copy: string;
    copied: string;
    share: string;
    invitesLeft: string;
    conversionsTitle: string;
    conversionsEmpty: string;
  };
};

export function HostInviteShareBlock({
  locale,
  slug,
  token,
  remaining,
  conversions,
  eventTitle,
  labels,
}: HostInviteShareBlockProps) {
  const inviteUrl = useMemo(
    () => buildHostInviteUrl(locale, slug, token),
    [locale, slug, token],
  );
  const [copied, setCopied] = useState(false);
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function handleShare() {
    if (!canShare) {
      await handleCopy();

      return;
    }
    try {
      await navigator.share({
        title: eventTitle,
        url: inviteUrl,
      });
    } catch {
      /* user cancelled or unsupported */
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
        <div className="flex gap-2 shrink-0">
          <NeonButton
            aria-label={labels.copy}
            className="px-4 py-2.5 text-[10px] tracking-[0.15em]"
            type="button"
            onPress={() => void handleCopy()}
          >
            {copied ? labels.copied : labels.copy}
          </NeonButton>
          {canShare ? (
            <NeonButton
              aria-label={labels.share}
              className="px-4 py-2.5 text-[10px] tracking-[0.15em]"
              type="button"
              variant="bordered"
              onPress={() => void handleShare()}
            >
              {labels.share}
            </NeonButton>
          ) : null}
        </div>
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
          <ul className="space-y-2" data-testid="host-invite-conversions">
            {conversions.map((guest) => {
              const name = [guest.givenName, guest.familyName]
                .filter(Boolean)
                .join(" ");
              const dateLabel = formatLocaleDate(guest.registeredAt, locale);

              return (
                <li
                  key={guest.orderId}
                  data-testid={`host-invite-conversion-${guest.orderId}`}
                >
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
