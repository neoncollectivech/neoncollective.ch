"use client";

import { useQueryClient } from "@tanstack/react-query";

import { eventsKeys } from "./keys";

export function useEventsInvalidate() {
  const queryClient = useQueryClient();

  return {
    catalog: async (inviteToken?: string) => {
      await queryClient.invalidateQueries({
        queryKey: eventsKeys.catalog(inviteToken),
      });
      await queryClient.invalidateQueries({ queryKey: eventsKeys.catalog() });
    },
    event: async (slug: string, inviteToken?: string) => {
      await queryClient.invalidateQueries({
        queryKey: eventsKeys.detail(slug, inviteToken),
      });
    },
    participant: async () => {
      await queryClient.invalidateQueries({
        queryKey: eventsKeys.participant.profile(),
      });
      await queryClient.invalidateQueries({
        queryKey: eventsKeys.participant.session(),
      });
      await queryClient.invalidateQueries({ queryKey: eventsKeys.catalog() });
    },
    participantSurface: async (opts?: {
      slug?: string;
      inviteToken?: string;
    }) => {
      await queryClient.invalidateQueries({
        queryKey: eventsKeys.participant.profile(),
      });
      await queryClient.invalidateQueries({
        queryKey: eventsKeys.participant.session(),
      });
      await queryClient.invalidateQueries({ queryKey: eventsKeys.catalog() });
      if (opts?.slug) {
        await queryClient.invalidateQueries({
          queryKey: eventsKeys.detail(opts.slug, opts.inviteToken),
        });
      }
    },
  };
}
