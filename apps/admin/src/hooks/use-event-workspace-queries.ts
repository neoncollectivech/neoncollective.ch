import { useQuery } from "@tanstack/react-query";

import { adminApi } from "@/hooks/use-admin-api";
import { computeEventCapacityFromTiers } from "@/lib/admin-types";

export function useEventWorkspaceQueries(eventId: string) {
  const eventQuery = useQuery({
    ...adminApi.event.detail(eventId),
    enabled: Boolean(eventId),
  });
  const tiersQuery = useQuery({
    ...adminApi.event.tiers(eventId),
    enabled: Boolean(eventId),
  });

  const event = eventQuery.data;
  const tiers = tiersQuery.data?.items ?? [];
  const capacity =
    event && !tiersQuery.isLoading
      ? computeEventCapacityFromTiers(tiers, event.eventQuota)
      : undefined;

  const isLoading = eventQuery.isLoading || tiersQuery.isLoading;

  return {
    event,
    tiers,
    capacity,
    eventQuery,
    tiersQuery,
    isLoading,
  };
}
