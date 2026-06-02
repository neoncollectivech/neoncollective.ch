export type PayShareCtaLabels = {
  completeRegistration: string;
  payYourShare: string;
};

export function formatPayShareCta(
  amountCents: number,
  labels: PayShareCtaLabels,
): string {
  if (amountCents <= 0) {
    return labels.completeRegistration;
  }

  const amount = (amountCents / 100).toFixed(0);

  return labels.payYourShare.replace("{amount}", amount);
}
