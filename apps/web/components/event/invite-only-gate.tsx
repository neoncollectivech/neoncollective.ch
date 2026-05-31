"use client";

import type { QueryKey } from "@tanstack/react-query";

import { NeonCard, NeonCardBody } from "@/components/neon-card";
import { NeonLink } from "@/components/neon-link";
import { ParticipantSessionPanel } from "@/components/participant-session-panel";
import { neonPanelBodyPaddingClass } from "@/config/modal-chrome";

type InviteOnlyGateProps = {
  eventTitle: string;
  needInviteCopy: string;
  gateTitle: string;
  backHref: string;
  backLabel: string;
  returnPath: string;
  codeExchangePending?: boolean;
  sessionEstablishedQueryKeys?: QueryKey[];
};

export function InviteOnlyGate({
  eventTitle,
  needInviteCopy,
  gateTitle,
  backHref,
  backLabel,
  returnPath,
  codeExchangePending,
  sessionEstablishedQueryKeys = [],
}: InviteOnlyGateProps) {
  return (
    <div className="max-w-xl mx-auto w-full min-w-0">
      <NeonLink
        className="text-sm text-foreground/45 mb-6 inline-block"
        href={backHref}
        neonStyle="inline"
      >
        ← {backLabel}
      </NeonLink>

      <div className="neon-line w-12 mb-6" />

      <NeonCard data-testid="invite-only-empty-state" surface="default">
        <NeonCardBody className={neonPanelBodyPaddingClass}>
          <p className="neon-label mb-2">{gateTitle}</p>
          <h1 className="neon-title-section mb-4">{eventTitle}</h1>
          <p className="neon-body mb-8">{needInviteCopy}</p>

          <ParticipantSessionPanel
            embedded
            hideIntro
            codeExchangePending={codeExchangePending}
            returnPath={returnPath}
            sessionEstablishedQueryKeys={sessionEstablishedQueryKeys}
          />
        </NeonCardBody>
      </NeonCard>
    </div>
  );
}
