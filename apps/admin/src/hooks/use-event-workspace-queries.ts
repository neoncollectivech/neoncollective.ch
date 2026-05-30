import { useQuery } from "@tanstack/react-query";

import { adminApi } from "@/hooks/use-admin-api";

export function useEventWorkspaceQueries(eventId: string) {
  const eventQuery = useQuery({
    ...adminApi.event.detail(eventId),
    enabled: Boolean(eventId),
  });
  const tiersQuery = useQuery({
    ...adminApi.event.tiers(eventId),
    enabled: Boolean(eventId),
  });
  const capacityQuery = useQuery({
    ...adminApi.event.capacityUsage(eventId),
    enabled: Boolean(eventId),
  });

  const event = eventQuery.data;
  const tiers = tiersQuery.data?.items ?? [];
  const capacity = event
    ? {
        used: capacityQuery.data?.used ?? 0,
        remaining:
          event.eventQuota != null
            ? Math.max(0, event.eventQuota - (capacityQuery.data?.used ?? 0))
            : null,
      }
    : undefined;

  const isLoading =
    eventQuery.isLoading || tiersQuery.isLoading || capacityQuery.isLoading;

  return {
    event,
    tiers,
    capacity,
    eventQuery,
    tiersQuery,
    capacityQuery,
    isLoading,
  };
}
