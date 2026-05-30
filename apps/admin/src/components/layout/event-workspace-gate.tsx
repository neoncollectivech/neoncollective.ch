import type {
  EventCapacitySnapshot,
  EventDetail,
  TierRow,
} from "@/lib/admin-types";
import type { ReactNode } from "react";

import { useEventWorkspaceQueries } from "@/hooks/use-event-workspace-queries";

export type EventWorkspaceContext = {
  event: EventDetail;
  tiers: TierRow[];
  capacity: EventCapacitySnapshot | undefined;
  isLoading: boolean;
};

type EventWorkspaceGateProps = {
  eventId: string;
  children: (ctx: EventWorkspaceContext) => ReactNode;
};

export function EventWorkspaceGate({
  eventId,
  children,
}: EventWorkspaceGateProps) {
  const ctx = useEventWorkspaceQueries(eventId);

  if (ctx.isLoading && !ctx.event) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!ctx.event) {
    return <p className="text-muted-foreground">Event not found.</p>;
  }

  return children({
    event: ctx.event,
    tiers: ctx.tiers,
    capacity: ctx.capacity,
    isLoading: ctx.isLoading,
  });
}
