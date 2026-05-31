"use client";

import { NeonLink } from "@/components/neon-link";

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
    <section
      className="mb-10 md:mb-12 max-w-xl border border-foreground/10 bg-foreground/[0.02] px-6 py-8"
      data-testid="invite-only-empty-state"
    >
      <h2 className="text-lg font-semibold text-foreground/85 mb-3">{title}</h2>
      <p className="text-base text-foreground/50 leading-relaxed mb-6">
        {body}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <button
          className="text-sm font-semibold text-neon/80 hover:text-neon text-left"
          type="button"
          onClick={onSignInClick}
        >
          {signInCta} →
        </button>
        <NeonLink className="text-sm" href={backHref} neonStyle="inline">
          ← {backLabel}
        </NeonLink>
      </div>
    </section>
  );
}
