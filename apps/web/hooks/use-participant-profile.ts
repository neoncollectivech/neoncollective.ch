"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  establishAnonymousSession,
  fetchParticipantProfile,
  type ParticipantProfile,
} from "@/helpers/eventsApi";
import {
  eventsCatalogQueryKey,
  participantProfileQueryKey,
  participantSessionQueryKey,
} from "@/helpers/queryKeys";

export function useParticipantProfileBootstrap(inviteToken?: string) {
  const queryClient = useQueryClient();
  const hasInviteInUrl = Boolean(inviteToken?.trim());

  const profileQuery = useQuery({
    queryKey: [...participantProfileQueryKey, inviteToken ?? ""],
    queryFn: async (): Promise<ParticipantProfile | null> => {
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
  });

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
    invalidateAfterProfileComplete: async () => {
      await queryClient.invalidateQueries({
        queryKey: participantProfileQueryKey,
      });
      await queryClient.invalidateQueries({ queryKey: eventsCatalogQueryKey });
      await queryClient.invalidateQueries({
        queryKey: participantSessionQueryKey,
      });
    },
  };
}

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
