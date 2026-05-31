export type ContributionCtaLabels = {
  completeRegistration: string;
  confirmContribution: string;
};

export function formatContributionCta(
  amountCents: number,
  labels: ContributionCtaLabels,
): string {
  if (amountCents <= 0) {
    return labels.completeRegistration;
  }

  const amount = (amountCents / 100).toFixed(0);

  return labels.confirmContribution.replace("{amount}", amount);
}
