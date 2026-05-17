"use client";

import type { Locale } from "@/i18n/config";
import type { ParticipantProfile } from "@/helpers/eventsApi";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { eventsApi } from "./api.js";
import { useEventsInvalidate } from "./invalidate.js";

export type ProfileModalLabels = {
  title: string;
  subtitle: string;
  givenName: string;
  familyName: string;
  email: string;
  phone: string;
  phoneOptional: string;
  contactHint: string;
  saveCta: string;
  verifyTitle: string;
  verifyEmailHint: string;
  verifyPhoneHint: string;
  verifyCodeLabel: string;
  verifyCodePlaceholder: string;
  verifyCta: string;
  resendCta: string;
  errorGeneric: string;
};

export type ProfileBootstrapResult = {
  profile?: ParticipantProfile | null;
  inviteFlow: boolean;
  needsProfile: boolean;
  isLoading: boolean;
  isError: boolean;
  refetchProfile: ReturnType<
    typeof useQuery<ParticipantProfile | null>
  >["refetch"];
  invalidateAfterProfileComplete: () => Promise<void>;
};

export function useProfileBootstrap(
  inviteToken?: string,
): ProfileBootstrapResult {
  const invalidate = useEventsInvalidate();
  const hasInviteInUrl = Boolean(inviteToken?.trim());

  const profileQuery = useQuery(eventsApi.participant.profile({ inviteToken }));

  const inviteFlow = hasInviteInUrl || Boolean(profileQuery.data?.inviteFlow);
  const needsProfile =
    inviteFlow &&
    profileQuery.data != null &&
    !profileQuery.data.profileComplete;
  const profileLoading = hasInviteInUrl && profileQuery.isLoading;

  return {
    profile: profileQuery.data ?? undefined,
    inviteFlow,
    needsProfile,
    isLoading: profileLoading,
    isError: profileQuery.isError,
    refetchProfile: profileQuery.refetch,
    invalidateAfterProfileComplete: () => invalidate.participant(),
  };
}

/** @deprecated Use useProfileBootstrap */
export const useParticipantProfileBootstrap = useProfileBootstrap;

export function useParticipantSession(opts: {
  locale: Locale;
  returnPath: string;
  enabled?: boolean;
  sessionEstablishedQueryKeys?: readonly unknown[][];
}) {
  const queryClient = useQueryClient();
  const invalidate = useEventsInvalidate();
  const enabled = opts.enabled ?? true;

  const sessionStatusQuery = useQuery(
    eventsApi.participant.session({ enabled }),
  );
  const requestMutation = useMutation(eventsApi.registration.requestSession());
  const exchangeMutation = useMutation(
    eventsApi.registration.exchangeSession(),
  );

  const sessionEstablished = sessionStatusQuery.data?.session === true;

  async function invalidateAfterExchange() {
    await invalidate.participant();
    for (const key of opts.sessionEstablishedQueryKeys ?? []) {
      await queryClient.invalidateQueries({ queryKey: key });
    }
  }

  return {
    sessionStatusQuery,
    sessionEstablished,
    requestMutation,
    exchangeMutation,
    invalidateAfterExchange,
  };
}

/**
 * Exchanges `?code=` from the sign-in link (GET on the static site), then strips it from the URL.
 */
export function useExchangeRegistrationCode(params: {
  code: string | undefined;
  sessionErrorLabel: string;
  onInvalidated?: () => void | Promise<void>;
}): { codeHandled: boolean; codeError: string | null } {
  const exchangeMutation = useMutation(
    eventsApi.registration.exchangeSession(),
  );
  const [codeHandled, setCodeHandled] = useState(!params.code);
  const [codeError, setCodeError] = useState<string | null>(null);
  const onInvalidatedRef = useRef(params.onInvalidated);

  onInvalidatedRef.current = params.onInvalidated;

  useEffect(() => {
    if (!params.code || codeHandled) {
      return;
    }
    let cancelled = false;

    void (async () => {
      const rawCode = params.code;

      if (!rawCode) {
        return;
      }
      try {
        await exchangeMutation.mutateAsync(rawCode);
        if (cancelled) {
          return;
        }
        setCodeHandled(true);
        const url = new URL(window.location.href);

        url.searchParams.delete("code");
        window.history.replaceState({}, "", url.toString());
        await onInvalidatedRef.current?.();
      } catch {
        if (!cancelled) {
          setCodeError(params.sessionErrorLabel);
          setCodeHandled(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per code
  }, [params.code, params.sessionErrorLabel, codeHandled]);

  return { codeHandled, codeError };
}

/** @deprecated Use useExchangeRegistrationCode */
export const useExchangeRegistrationSessionCode = useExchangeRegistrationCode;
