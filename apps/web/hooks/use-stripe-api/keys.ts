export const stripeKeys = {
  root: ["stripe"] as const,
  donation: {
    all: ["stripe", "donation"] as const,
    tiers: () => [...stripeKeys.donation.all, "tiers"] as const,
  },
} as const;
