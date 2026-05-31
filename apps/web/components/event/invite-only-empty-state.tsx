"use client";

import { NeonCard, NeonCardBody } from "@/components/neon-card";
import { NeonLink } from "@/components/neon-link";
import { NeonTextButton } from "@/components/neon-text-button";

type InviteOnlyEmptyStateProps = {
  title: string;
  body: string;
  signInCta: string;
  backLabel: string;
  backHref: string;
  onSignInClick: () => void;
};

export function InviteOnlyEmptyState({
  title,
  body,
  signInCta,
  backLabel,
  backHref,
  onSignInClick,
}: InviteOnlyEmptyStateProps) {
  return (
    <NeonCard
      className="mb-10 md:mb-12 max-w-xl"
      data-testid="invite-only-empty-state"
      surface="default"
    >
      <NeonCardBody>
        <h2 className="neon-title-card mb-3">{title}</h2>
        <p className="neon-body mb-6">{body}</p>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <NeonTextButton showArrow onClick={onSignInClick}>
            {signInCta}
          </NeonTextButton>
          <NeonLink className="text-sm" href={backHref} neonStyle="inline">
            ← {backLabel}
          </NeonLink>
        </div>
      </NeonCardBody>
    </NeonCard>
  );
}
