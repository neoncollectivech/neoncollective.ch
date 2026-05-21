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
  for (const prefix of [
    eventsKeys.participant.profile(),
    eventsKeys.participant.profile(inviteToken),
  ]) {
    queryClient.setQueriesData<ParticipantProfile | null>(
      { queryKey: prefix },
      profile,
    );
  }
}
