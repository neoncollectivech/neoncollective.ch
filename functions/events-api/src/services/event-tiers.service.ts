import {
  introspectTable,
  listMetaFromScope,
  runAdminListFromScope,
  type ListQuery,
  type ListResult,
} from "@neon/resource-api";
import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "../db/index";
import { eventTiers } from "../db/schema";
import { enrichTiersWithCapacityStats } from "../helpers/tier-capacity";
import type { EntityTx } from "./transaction";
import { TableService } from "./base/table-service";
import type { ServiceContext } from "./base/types";
import { eventsService } from "./events.service";

export { eventTiers as eventTiersTable };

export const eventTierListFields = [
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

export const eventTiersResourceMeta = introspectTable(eventTiers, {
  fields: {
    list: [...eventTierListFields],
    read: [...eventTierListFields],
  },
  list: { defaultSort: "sortOrder" },
});

export type TierTx = EntityTx;

export type TierInput = {
  id: string | null;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  quota: number | null;
  sortOrder: number;
  active: boolean;
  selectionMode: "exclusive" | "addon";
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export type EventTierRow = typeof eventTiers.$inferSelect;

export type EventTierListRow = Pick<
  EventTierRow,
  (typeof eventTierListFields)[number]
>;

export type EventTierListItem = EventTierListRow & {
  sold: number;
  placesRemaining: number | null;
};

function parseSelectionMode(value: unknown): EventTierRow["selectionMode"] {
  return value === "addon" ? "addon" : "exclusive";
}

function projectEventTierListRow(row: Record<string, unknown>): EventTierListRow {
  const quotaRaw = row.quota;

  return {
    id: String(row.id),
    eventId: String(row.eventId),
    name: String(row.name),
    description: String(row.description ?? ""),
    priceCents: Number(row.priceCents),
    currency: String(row.currency),
    quota:
      quotaRaw === null || quotaRaw === undefined ? null : Number(quotaRaw),
    sortOrder: Number(row.sortOrder),
    active: Boolean(row.active),
    selectionMode: parseSelectionMode(row.selectionMode),
  };
}

export class EventTiersService extends TableService<
  typeof eventTiers,
  typeof eventTiers.$inferSelect,
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, string | string[] | undefined>,
  EventTierListItem
> {
  constructor() {
    super({
      table: eventTiers,
      meta: eventTiersResourceMeta,
      defaultSort: "sortOrder",
    });
  }

  protected listExecution(): "custom" {
    return "custom";
  }

  protected async executeCustomList(
    query: ListQuery<Record<string, string | string[] | undefined>>,
    ctx?: ServiceContext,
  ): Promise<ListResult<EventTierListItem>> {
    const eventIdFilter =
      typeof query.filters.eventId === "string" ? query.filters.eventId : undefined;
    const idInRaw = query.filters.id_in;
    const hasIdIn =
      typeof idInRaw === "string" && idInRaw.trim().length > 0;

    if (!eventIdFilter && !hasIdIn) {
      return {
        items: [],
        meta: { total: 0, limit: query.limit, skip: query.skip },
      };
    }

    const scope = await this.resolveListScope(query, ctx);
    const db = this.getDb();
    const { rows, total } = await runAdminListFromScope({
      db,
      table: this.table,
      scope,
    });
    const listRows = rows.map(projectEventTierListRow);

    if (listRows.length === 0) {
      return {
        items: [],
        meta: listMetaFromScope(scope, total),
      };
    }

    const eventId = eventIdFilter ?? listRows[0]!.eventId;
    const event = await eventsService.get(eventId);
    if (!event) {
      return {
        items: listRows.map((row) => ({
          ...row,
          sold: 0,
          placesRemaining: null,
        })),
        meta: listMetaFromScope(scope, total),
      };
    }

    const { tiers } = await enrichTiersWithCapacityStats(
      eventId,
      event.eventQuota,
      listRows,
    );
    const tierById = new Map(tiers.map((tier) => [tier.id, tier]));

    return {
      items: listRows.map((row): EventTierListItem => {
        const enriched = tierById.get(row.id);

        return {
          ...row,
          sold: enriched?.sold ?? 0,
          placesRemaining: enriched?.placesRemaining ?? null,
        };
      }),
      meta: listMetaFromScope(scope, total),
    };
  }

  protected async executeCustomCount(
    query: ListQuery<Record<string, string | string[] | undefined>>,
    ctx?: ServiceContext,
  ): Promise<number> {
    return this.countFromTable(query, ctx);
  }

  async findExclusiveTierIdAmong(
    tierIds: string[],
    tx?: TierTx,
  ): Promise<string | null> {
    if (tierIds.length === 0) {
      return null;
    }
    const executor = tx ?? getDb();
    const [row] = await executor
      .select({ id: eventTiers.id })
      .from(eventTiers)
      .where(
        and(inArray(eventTiers.id, tierIds), eq(eventTiers.selectionMode, "exclusive")),
      )
      .limit(1);
    return row?.id ?? null;
  }

  async listForEvent(eventId: string) {
    const db = getDb();
    return db
      .select()
      .from(eventTiers)
      .where(eq(eventTiers.eventId, eventId))
      .orderBy(asc(eventTiers.sortOrder));
  }

  async getByIds(ids: string[], tx?: TierTx): Promise<(typeof eventTiers.$inferSelect)[]> {
    if (ids.length === 0) {
      return [];
    }
    const executor = tx ?? getDb();
    const rows = await executor
      .select()
      .from(eventTiers)
      .where(inArray(eventTiers.id, ids));
    rows.sort((a, b) => a.sortOrder - b.sortOrder);
    return rows;
  }

  async listActiveForEvent(eventId: string, tx?: TierTx) {
    const executor = tx ?? getDb();
    return executor
      .select()
      .from(eventTiers)
      .where(and(eq(eventTiers.eventId, eventId), eq(eventTiers.active, true)))
      .orderBy(asc(eventTiers.sortOrder));
  }

  async replaceTiers(
    eventId: string,
    tiers: TierInput[],
    opts: { canRemoveTier: (tierId: string, tx: TierTx) => Promise<boolean> },
  ): Promise<
    | { ok: true; tiers: (typeof eventTiers.$inferSelect)[] }
    | { ok: false; reason: "unknown_tier_id" | "tier_in_use"; message?: string }
  > {
    const db = getDb();

    const result = await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(eventTiers)
        .where(eq(eventTiers.eventId, eventId));

      const existingById = new Map(existing.map((t) => [t.id, t]));
      const keptIds: string[] = [];

      for (const tier of tiers) {
        if (!isUuid(tier.id)) {
          continue;
        }
        if (!existingById.has(tier.id!)) {
          return {
            kind: "fail" as const,
            reason: "unknown_tier_id" as const,
            message: `Unknown tier id "${tier.id}" for this event.`,
          };
        }
        keptIds.push(tier.id!);
      }

      const toRemove = existing.filter((t) => !keptIds.includes(t.id));
      for (const tier of toRemove) {
        const canRemove = await opts.canRemoveTier(tier.id, tx);
        if (!canRemove) {
          return {
            kind: "fail" as const,
            reason: "tier_in_use" as const,
            message: `Cannot remove tier "${tier.name}" — it is used by existing orders. Deactivate it instead.`,
          };
        }
      }

      if (toRemove.length > 0) {
        await tx.delete(eventTiers).where(
          inArray(
            eventTiers.id,
            toRemove.map((t) => t.id),
          ),
        );
      }

      const updated: (typeof eventTiers.$inferSelect)[] = [];

      for (const tier of tiers) {
        const values = {
          name: tier.name,
          description: tier.description,
          priceCents: tier.priceCents,
          currency: tier.currency.toLowerCase(),
          quota: tier.quota,
          sortOrder: tier.sortOrder,
          active: tier.active,
          selectionMode: tier.selectionMode,
        };

        if (isUuid(tier.id) && existingById.has(tier.id)) {
          const tierId = tier.id;
          const [row] = await tx
            .update(eventTiers)
            .set(values)
            .where(and(eq(eventTiers.id, tierId), eq(eventTiers.eventId, eventId)))
            .returning();
          if (row) {
            updated.push(row);
          }
          continue;
        }

        const [row] = await tx
          .insert(eventTiers)
          .values({
            eventId,
            ...values,
          })
          .returning();
        if (row) {
          updated.push(row);
        }
      }

      updated.sort((a, b) => a.sortOrder - b.sortOrder);
      return updated;
    });

    if (!Array.isArray(result)) {
      return {
        ok: false,
        reason: result.reason,
        message: result.message,
      };
    }

    return { ok: true, tiers: result };
  }
}

export const eventTiersService = new EventTiersService();
