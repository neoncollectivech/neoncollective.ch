"use client";

import type { QueryKey } from "@tanstack/react-query";
import type { Locale } from "@/i18n/config";
import type { ParticipantProfile } from "@/helpers/eventsApi";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { checkoutConfirmErrorMessage } from "@/helpers/checkout-confirm";

import { eventsApi } from "./api";
import { eventsKeys } from "./keys";
import { useEventsInvalidate } from "./invalidate";

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

  const sessionQuery = useQuery(eventsApi.participant.session());
  const profileQuery = useQuery(eventsApi.participant.profile({ inviteToken }));

  const inviteFlow = hasInviteInUrl || Boolean(profileQuery.data?.inviteFlow);
  const sessionEstablished = Boolean(sessionQuery.data?.session);
  const needsProfile =
    profileQuery.data != null &&
    !profileQuery.data.profileComplete &&
    (inviteFlow || sessionEstablished);
  /** Initial load only — background refetch must not unmount the profile modal mid-verification. */
  const profileLoading = profileQuery.isLoading;

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

export function useParticipantSession(opts: {
  locale: Locale;
  returnPath: string;
  enabled?: boolean;
  sessionEstablishedQueryKeys?: readonly QueryKey[];
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
        const nextParams = new URLSearchParams(searchParams.toString());

        nextParams.delete("code");
        const qs = nextParams.toString();

        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
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
  }, [
    params.code,
    params.sessionErrorLabel,
    codeHandled,
    pathname,
    router,
    searchParams,
  ]);

  return { codeHandled, codeError };
}

export type CheckoutConfirmationLabels = {
  timeout: string;
  generic: string;
};

/**
 * After Stripe payment: confirm order (retry) then poll event until registered (retry).
 * Syncs confirmed event into the detail query cache on success.
 */
export function useCheckoutConfirmation(params: {
  slug: string;
  inviteToken?: string;
  errorLabels: CheckoutConfirmationLabels;
}) {
  const queryClient = useQueryClient();
  const [orderId, setOrderId] = useState<string | null>(null);

  const confirmQuery = useQuery(eventsApi.checkout.confirmPoll(orderId));

  const registrationQuery = useQuery(
    eventsApi.checkout.registrationPoll({
      slug: params.slug,
      inviteToken: params.inviteToken,
      enabled: Boolean(orderId) && confirmQuery.isSuccess,
    }),
  );

  useEffect(() => {
    if (!registrationQuery.data) {
      return;
    }
    queryClient.setQueryData(
      eventsKeys.detail(params.slug, params.inviteToken),
      registrationQuery.data,
    );
    setOrderId(null);
  }, [params.inviteToken, params.slug, queryClient, registrationQuery.data]);

  const isConfirming = Boolean(orderId);

  const errorMessage = (() => {
    if (confirmQuery.isError) {
      return checkoutConfirmErrorMessage(
        confirmQuery.error,
        params.errorLabels,
      );
    }
    if (registrationQuery.isError) {
      return checkoutConfirmErrorMessage(
        registrationQuery.error,
        params.errorLabels,
      );
    }

    return null;
  })();

  const resetConfirmation = () => {
    setOrderId(null);
    if (orderId) {
      queryClient.removeQueries({
        queryKey: eventsKeys.checkout.confirm(orderId),
      });
    }
    queryClient.removeQueries({
      queryKey: eventsKeys.checkout.registration(
        params.slug,
        params.inviteToken,
      ),
    });
  };

  return {
    orderId,
    startConfirmation: setOrderId,
    resetConfirmation,
    isConfirming,
    errorMessage,
  };
}
