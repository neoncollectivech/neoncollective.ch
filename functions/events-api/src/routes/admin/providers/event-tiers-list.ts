import {
  introspectPgTable,
  listMetaFromScope,
  parseListQuery,
  resolveAdminListScope,
  runAdminListFromScope,
  type ListProviderResult,
} from "@neon/admin-crud";
import type { AdminCrudContext } from "@neon/admin-crud";

import { eventTiersTable } from "../../../services/event-tiers.service";
import { getAdminCrudDb } from "../../../services/admin/crud-mount";
import { eventsService } from "../../../services/events.service";
import { enrichTiersWithCapacityStats } from "../../shared/tier-capacity";

const tierListFields = [
  "id",
  "eventId",
  "name",
  "description",
  "priceCents",
  "currency",
  "quota",
  "sortOrder",
  "active",
  "selectionMode",
] as const;

const eventTiersListMeta = introspectPgTable(eventTiersTable);

export async function listAdminEventTiers(
  c: AdminCrudContext,
): Promise<ListProviderResult> {
  const raw = c.req.query() as Record<string, string | string[] | undefined>;
  const query = parseListQuery(raw);
  const eventId =
    typeof query.filters.eventId === "string" ? query.filters.eventId : undefined;

  if (!eventId) {
    return {
      items: [],
      meta: { total: 0, limit: query.limit, skip: query.skip },
    };
  }

  const event = await eventsService.get(eventId);
  if (!event) {
    return {
      items: [],
      meta: { total: 0, limit: query.limit, skip: query.skip },
    };
  }

  const scope = resolveAdminListScope(
    {
      query,
      filterable: eventTiersListMeta.filterable,
      sortFields: eventTiersListMeta.sortFields,
      defaultSort: "sortOrder",
    },
    eventTiersTable.id,
  );

  const db = getAdminCrudDb();
  const { rows, total } = await runAdminListFromScope({
    db,
    table: eventTiersTable,
    scope,
  });

  const { tiers } = await enrichTiersWithCapacityStats(
    eventId,
    event.eventQuota,
    rows as { id: string; quota: number | null }[],
  );

  const tierById = new Map(tiers.map((tier) => [tier.id, tier]));

  return {
    items: rows.map((row) => {
      const enriched = tierById.get(String(row.id));
      const base = Object.fromEntries(
        tierListFields.map((key) => [key, row[key as keyof typeof row]]),
      );

      return {
        ...base,
        sold: enriched?.sold ?? 0,
        placesRemaining: enriched?.placesRemaining ?? null,
      };
    }),
    meta: listMetaFromScope(scope, total),
  };
}
