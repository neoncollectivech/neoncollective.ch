import type { QueryClient } from "@tanstack/react-query";

import type { ParticipantProfile } from "@/helpers/eventsApi";

import { eventsKeys } from "./keys";

/**
 * Sync profile after save/verify. The profile query uses a `bootstrap` key segment;
 * setQueryData on the base key alone leaves the active query stale until refresh.
 */
export function writeParticipantProfileCache(
  queryClient: QueryClient,
  profile: ParticipantProfile,
  inviteToken?: string,
) {
  const keys = [
    eventsKeys.participant.profile(),
    eventsKeys.participant.profile(inviteToken),
  ];
  const seen = new Set<string>();

  for (const queryKey of keys) {
    const id = JSON.stringify(queryKey);

    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    queryClient.setQueriesData<ParticipantProfile | null>(
      { queryKey },
      profile,
    );
  }
}
