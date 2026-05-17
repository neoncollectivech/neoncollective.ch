import { mutationOptions, queryOptions } from "@tanstack/react-query";

import {
  createCheckoutSession,
  fetchDonationTiers,
  requestPortalLink,
  type CheckoutParams,
  type PortalRequestParams,
} from "@/helpers/stripeApi";

import { stripeKeys } from "./keys";

export const stripeApi = {
  keys: stripeKeys,
  donation: {
    tiers: () =>
      queryOptions({
        queryKey: stripeKeys.donation.tiers(),
        queryFn: fetchDonationTiers,
        staleTime: 5 * 60 * 1000,
      }),
  },
  checkout: {
    session: () =>
      mutationOptions({
        mutationFn: (params: CheckoutParams) => createCheckoutSession(params),
      }),
  },
  portal: {
    link: () =>
      mutationOptions({
        mutationFn: (params: PortalRequestParams) => requestPortalLink(params),
      }),
  },
};
