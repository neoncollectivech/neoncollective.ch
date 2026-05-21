import { eventsService } from "../../../services/events.service";
import { eventTiersService } from "../../../services/event-tiers.service";
import { enrichTiersWithCapacityStats } from "../../shared/tier-capacity";

export async function getAdminEventDetail(id: string) {
  const row = await eventsService.get(id);
  if (!row) {
    return null;
  }
  const tiers = await eventTiersService.listForEvent(id);
  const { tiers: tiersWithCapacity, capacity } = await enrichTiersWithCapacityStats(
    id,
    row.eventQuota,
    tiers,
  );
  return { ...row, tiers: tiersWithCapacity, capacity };
}
