"use client";

import type { Locale } from "@/i18n/config";
import type {
  HostInviteState,
  InviteLinkConversion,
} from "@/helpers/eventsApi";

import { useCallback, useEffect, useState } from "react";

import { ensureHostInvite, regenerateHostInvite } from "@/helpers/eventsApi";
import { NeonButton } from "@/components/neon-button";
import { HostInviteShareBlock } from "@/components/event/host-invite-share-block";

const storageKey = (slug: string) => `neon:hostInvite:${slug}`;

type HostInvitePanelProps = {
  locale: Locale;
  slug: string;
  eventTitle: string;
  hostInvite: HostInviteState & { linkExists: boolean };
  labels: {
    hostInviteGuestsTitle: string;
    hostInviteLinkLabel: string;
    hostInviteCopy: string;
    hostInviteCopied: string;
    hostInviteShare: string;
    hostInvitesLeft: string;
    hostInviteConversionsTitle: string;
    hostInviteConversionsEmpty: string;
    hostInviteRegenerate: string;
  };
};

export function HostInvitePanel({
  locale,
  slug,
  eventTitle,
  hostInvite,
  labels,
}: HostInvitePanelProps) {
  const [token, setToken] = useState<string | null>(hostInvite.token ?? null);
  const [remaining, setRemaining] = useState(hostInvite.remaining);
  const [conversions, setConversions] = useState<InviteLinkConversion[]>(
    hostInvite.conversions,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persistToken = useCallback(
    (value: string) => {
      setToken(value);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(storageKey(slug), value);
      }
    },
    [slug],
  );

  useEffect(() => {
    if (hostInvite.token) {
      persistToken(hostInvite.token);

      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const stored = sessionStorage.getItem(storageKey(slug))?.trim();

    if (stored) {
      setToken(stored);
    }
  }, [hostInvite.token, persistToken, slug]);

  useEffect(() => {
    if (hostInvite.linkExists || token) {
      return;
    }
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await ensureHostInvite(slug);

        setRemaining(result.remaining);
        setConversions(result.conversions);
        if (result.token) {
          persistToken(result.token);
        }
      } catch {
        setError("Could not load invite link.");
      } finally {
        setLoading(false);
      }
    })();
  }, [hostInvite.linkExists, persistToken, slug, token]);

  async function handleRegenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await regenerateHostInvite(slug);

      setRemaining(result.remaining);
      setConversions(result.conversions);
      persistToken(result.token);
    } catch {
      setError("Could not regenerate invite link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 pt-6 border-t border-foreground/10">
      <h3 className="neon-title-card mb-4 text-foreground/70">
        {labels.hostInviteGuestsTitle}
      </h3>
      {token ? (
        <>
          <HostInviteShareBlock
            conversions={conversions}
            eventTitle={eventTitle}
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
            remaining={remaining}
            slug={slug}
            token={token}
          />
          <div className="mt-3">
            <NeonButton
              className="px-4 py-2.5 text-[10px] tracking-[0.15em]"
              isDisabled={loading}
              type="button"
              variant="bordered"
              onPress={() => void handleRegenerate()}
            >
              {labels.hostInviteRegenerate}
            </NeonButton>
          </div>
        </>
      ) : (
        <p className="text-sm text-foreground/45">
          {loading
            ? "Loading invite link…"
            : labels.hostInvitesLeft.replaceAll("{count}", String(remaining))}
        </p>
      )}
      {error ? <p className="text-sm text-danger mt-2">{error}</p> : null}
    </div>
  );
}
