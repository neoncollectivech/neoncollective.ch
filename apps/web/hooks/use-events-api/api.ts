import type { Locale } from "@/i18n/config";

import { mutationOptions, queryOptions } from "@tanstack/react-query";

import {
  checkoutConfirmRetryDelay,
  isRetryableCheckoutConfirmError,
  isRegistrationPendingError,
  RegistrationPendingError,
} from "@/helpers/checkout-confirm";
import { queryClient } from "@/helpers/queryClient";
import {
  confirmEventCheckout,
  confirmProfileVerification,
  createEventCheckoutIntent,
  previewEventCheckoutPricing,
  establishAnonymousSession,
  exchangeRegistrationSessionCode,
  fetchEvent,
  fetchEventsCatalog,
  fetchParticipantProfile,
  fetchParticipantSessionStatus,
  requestProfileVerification,
  requestRegistrationSessionLink,
  updateParticipantProfile,
} from "@/helpers/eventsApi";

import { eventsKeys } from "./keys";
import { stashCheckoutOrderId, takeCheckoutOrderId } from "./storage";

async function invalidateParticipant() {
  await queryClient.invalidateQueries({
    queryKey: eventsKeys.participant.profile(),
  });
  await queryClient.invalidateQueries({
    queryKey: eventsKeys.participant.session(),
  });
  await queryClient.invalidateQueries({ queryKey: eventsKeys.catalog() });
}

export const eventsApi = {
  keys: eventsKeys,
  catalog: (opts?: { inviteToken?: string; enabled?: boolean }) => {
    const inviteToken = opts?.inviteToken;
    const enabled = opts?.enabled ?? true;

    return queryOptions({
      queryKey: eventsKeys.catalog(inviteToken),
      queryFn: () => fetchEventsCatalog({ inviteToken }),
      enabled,
    });
  },
  event: {
    detail: (opts: {
      slug: string;
      inviteToken?: string;
      enabled?: boolean;
    }) => {
      const { slug, inviteToken } = opts;
      const enabled = opts.enabled ?? true;

      return queryOptions({
        queryKey: eventsKeys.detail(slug, inviteToken),
        queryFn: () => fetchEvent(slug, { inviteToken }),
        enabled: enabled && Boolean(slug),
        staleTime: 0,
      });
    },
  },
  participant: {
    profile: (opts?: { inviteToken?: string; enabled?: boolean }) => {
      const inviteToken = opts?.inviteToken;
      const enabled = opts?.enabled ?? true;
      const hasInviteInUrl = Boolean(inviteToken?.trim());

      return queryOptions({
        queryKey: [
          ...eventsKeys.participant.profile(inviteToken),
          { bootstrap: hasInviteInUrl },
        ] as const,
        queryFn: async () => {
          const existing = await fetchParticipantProfile();

          if (existing) {
            return existing;
          }
          if (!hasInviteInUrl) {
            return null;
          }

          return establishAnonymousSession({
            inviteToken: inviteToken ?? null,
          });
        },
        retry: false,
        staleTime: 30_000,
        enabled,
      });
    },
    profileRead: (opts?: { enabled?: boolean }) => {
      const enabled = opts?.enabled ?? true;

      return queryOptions({
        queryKey: eventsKeys.participant.profile(),
        queryFn: fetchParticipantProfile,
        retry: false,
        staleTime: 30_000,
        enabled,
      });
    },
    session: (opts?: { enabled?: boolean }) => {
      const enabled = opts?.enabled ?? true;

      return queryOptions({
        queryKey: eventsKeys.participant.session(),
        queryFn: fetchParticipantSessionStatus,
        enabled,
        retry: false,
      });
    },
  },
  checkout: {
    pricingPreview: (opts: {
      slug: string;
      exclusiveTierId: string;
      addonTierIds: string[];
      promotionCode: string | null;
      enabled?: boolean;
    }) => {
      const enabled = opts.enabled ?? true;

      return queryOptions({
        queryKey: eventsKeys.checkout.pricingPreview({
          slug: opts.slug,
          exclusiveTierId: opts.exclusiveTierId,
          addonTierIds: opts.addonTierIds,
          promotionCode: opts.promotionCode,
        }),
        queryFn: () =>
          previewEventCheckoutPricing({
            slug: opts.slug,
            exclusiveTierId: opts.exclusiveTierId,
            addonTierIds: opts.addonTierIds,
            promotionCode: opts.promotionCode,
          }),
        enabled:
          enabled &&
          Boolean(opts.slug) &&
          Boolean(opts.promotionCode?.trim()) &&
          (Boolean(opts.exclusiveTierId) || opts.addonTierIds.length > 0),
        staleTime: 30_000,
      });
    },
    intent: () =>
      mutationOptions({
        mutationFn: createEventCheckoutIntent,
      }),
    /** Retries with exponential backoff until POST /checkout/confirm succeeds. */
    confirmPoll: (orderId: string | null) =>
      queryOptions({
        queryKey: eventsKeys.checkout.confirm(orderId ?? ""),
        queryFn: () => confirmEventCheckout(orderId!),
        enabled: Boolean(orderId),
        retry: (failureCount, error) =>
          isRetryableCheckoutConfirmError(error) && failureCount < 15,
        retryDelay: checkoutConfirmRetryDelay,
        staleTime: Infinity,
        gcTime: 60_000,
      }),
    /** Retries with exponential backoff until the event shows registrationConfirmed. */
    registrationPoll: (opts: {
      slug: string;
      inviteToken?: string;
      enabled?: boolean;
    }) => {
      const enabled = opts.enabled ?? false;

      return queryOptions({
        queryKey: eventsKeys.checkout.registration(opts.slug, opts.inviteToken),
        queryFn: async () => {
          const event = await fetchEvent(opts.slug, {
            inviteToken: opts.inviteToken,
          });

          if (!event.registrationConfirmed) {
            throw new RegistrationPendingError();
          }

          return event;
        },
        enabled: enabled && Boolean(opts.slug),
        retry: (failureCount, error) =>
          isRegistrationPendingError(error) && failureCount < 14,
        retryDelay: checkoutConfirmRetryDelay,
        staleTime: 0,
        gcTime: 0,
      });
    },
  },
  profile: {
    update: () =>
      mutationOptions({
        mutationFn: updateParticipantProfile,
        onSuccess: async () => {
          await invalidateParticipant();
        },
      }),
    requestVerification: () =>
      mutationOptions({
        mutationFn: (body: { channel: "email" | "phone"; locale: Locale }) =>
          requestProfileVerification(body),
      }),
    confirmVerification: () =>
      mutationOptions({
        mutationFn: (body: { code: string }) =>
          confirmProfileVerification(body),
        onSuccess: async () => {
          await invalidateParticipant();
        },
      }),
  },
  registration: {
    requestSession: () =>
      mutationOptions({
        mutationFn: (body: {
          contact: string;
          locale: Locale;
          returnUrl: string;
        }) => requestRegistrationSessionLink(body),
      }),
    exchangeSession: () =>
      mutationOptions({
        mutationFn: (code: string) => exchangeRegistrationSessionCode(code),
        onSuccess: async () => {
          await invalidateParticipant();
        },
      }),
  },
  storage: {
    stashCheckoutOrderId,
    takeCheckoutOrderId,
  },
};
