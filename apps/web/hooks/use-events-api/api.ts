import type { Locale } from "@/i18n/config";

import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { queryClient } from "@/helpers/queryClient";
import {
  confirmEventCheckout,
  confirmProfileVerification,
  createEventCheckoutIntent,
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

import { eventsKeys } from "./keys.js";
import { stashCheckoutOrderId, takeCheckoutOrderId } from "./storage.js";

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
    intent: () =>
      mutationOptions({
        mutationFn: createEventCheckoutIntent,
      }),
    confirm: () =>
      mutationOptions({
        mutationFn: (orderId: string) => confirmEventCheckout(orderId),
      }),
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
