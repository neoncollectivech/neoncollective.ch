import {
  formatOrderTierNamesFromLines,
  type AdminOrderTierLine,
} from "../../helpers/order-tier-labels";
import { eventTiersService } from "../../services/event-tiers.service";
import { orderTiersService } from "../../services/order-tiers.service";
import type { EntityTx } from "../../services/transaction";

export type { AdminOrderTierLine };

export async function listAdminOrderTierLines(
  orderId: string,
  tx?: EntityTx,
): Promise<AdminOrderTierLine[]> {
  const lines = await orderTiersService.listForOrder(orderId, tx);
  if (lines.length === 0) {
    return [];
  }
  const tiers = await eventTiersService.getByIds(
    lines.map((l) => l.eventTierId),
    tx,
  );
  const tierById = new Map(tiers.map((t) => [t.id, t]));
  const out: AdminOrderTierLine[] = [];
  for (const line of lines) {
    const tier = tierById.get(line.eventTierId);
    if (!tier) {
      continue;
    }
    out.push({
      id: tier.id,
      name: tier.name,
      selectionMode: tier.selectionMode,
      unitPriceCents: line.unitPriceCents,
    });
  }
  out.sort((a, b) => {
    const sa = tierById.get(a.id)?.sortOrder ?? 0;
    const sb = tierById.get(b.id)?.sortOrder ?? 0;
    return sa - sb;
  });
  return out;
}

export async function formatOrderTierNames(orderId: string, tx?: EntityTx): Promise<string> {
  const lines = await listAdminOrderTierLines(orderId, tx);
  return formatOrderTierNamesFromLines(lines);
}
