"use client";

import type { ParticipantProfile } from "@/helpers/eventsApi";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ParticipantProfileModal } from "@/components/participant-profile-modal";
import { useDictionary } from "@/i18n/DictionaryContext";
import {
  useProfileBootstrap,
  writeParticipantProfileCache,
} from "@/hooks/use-events-api";
import { useProfileModalLabels } from "@/hooks/use-profile-modal-labels";

export function useParticipantProfileGate(inviteToken?: string) {
  const queryClient = useQueryClient();
  const [profileGateOpen, setProfileGateOpen] = useState(true);
  const profileLabels = useProfileModalLabels();

  const {
    profile,
    needsProfile,
    isLoading: profileLoading,
    invalidateAfterProfileComplete,
  } = useProfileBootstrap(inviteToken);

  useEffect(() => {
    if (!profileLoading && needsProfile) {
      setProfileGateOpen(true);
    }
  }, [profileLoading, needsProfile]);

  const showProfileGateModal =
    profileGateOpen && needsProfile && !profileLoading;

  async function onProfileComplete(nextProfile: ParticipantProfile) {
    writeParticipantProfileCache(queryClient, nextProfile, inviteToken);
    await invalidateAfterProfileComplete();
    setProfileGateOpen(false);
  }

  return {
    profile,
    needsProfile,
    profileLoading,
    showProfileGateModal,
    profileLabels,
    onProfileComplete,
    dimmedContentClassName: undefined,
  };
}

type ParticipantProfileGateModalProps = {
  inviteToken?: string;
  eventTitle?: string;
  gate: ReturnType<typeof useParticipantProfileGate>;
};

export function ParticipantProfileGateModal({
  gate,
  eventTitle,
}: ParticipantProfileGateModalProps) {
  const { dictionary } = useDictionary();
  const contextTitle =
    eventTitle?.trim() &&
    dictionary.events.profileModalContextJoin.replaceAll(
      "{eventTitle}",
      eventTitle.trim(),
    );

  if (!gate.showProfileGateModal) {
    return null;
  }

  return (
    <ParticipantProfileModal
      open
      contextTitle={contextTitle || undefined}
      dismissable={false}
      initialProfile={gate.profile ?? undefined}
      labels={gate.profileLabels}
      onComplete={gate.onProfileComplete}
    />
  );
}
