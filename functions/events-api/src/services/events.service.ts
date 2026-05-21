import {
  defineFilterable,
  filterable,
  introspectPgTable,
  parseListQuery,
  type InferFilterParams,
  type ListQuery,
} from "@neon/admin-crud";
import { and, eq } from "drizzle-orm";

import { events } from "../db/schema";
import { getDb } from "../db/index";
import {
  enrichTiersWithCapacityStats,
  listPublishedEventsCatalog,
  normalizeEventImageUrls,
  type CatalogListParams,
} from "./event-read";
import { listTiersForEvent } from "./admin/event-tiers";
import { TableService } from "./base/table-service";
import type { ServiceContext } from "./base/types";

const eventsFilterable = defineFilterable([
  filterable("status", events.status),
  filterable("accessMode", events.accessMode),
  filterable("startsAt", events.startsAt),
] as const);

export type EventsListFilters = InferFilterParams<typeof eventsFilterable>;

const eventsMeta = introspectPgTable(events, {
  exclude: { create: ["status"] },
  fields: {
    list: [
      "id",
      "slug",
      "title",
      "status",
      "accessMode",
      "startsAt",
      "createdAt",
    ],
  },
});

function parseStartsAt(value: string | null | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export class EventsService extends TableService<
  typeof events,
  typeof events.$inferSelect,
  Record<string, unknown>,
  Record<string, unknown>,
  EventsListFilters
> {
  constructor() {
    super({
      table: events,
      meta: eventsMeta,
      filterable: eventsFilterable,
      defaultSort: "-startsAt",
    });
  }

  parseListQuery(raw: Record<string, string | string[] | undefined>): ListQuery<EventsListFilters> {
    return parseListQuery<EventsListFilters>(raw);
  }

  /** Public catalog (delegates to shared event-read domain logic). */
  listPublishedCatalog(params: CatalogListParams) {
    return listPublishedEventsCatalog(params);
  }

  async getPublishedBySlug(slug: string): Promise<typeof events.$inferSelect | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(events)
      .where(and(eq(events.slug, slug), eq(events.status, "published")))
      .limit(1);
    return row ?? null;
  }

  async getDetail(id: string, _ctx?: ServiceContext) {
    const db = getDb();
    const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!row) {
      return null;
    }
    const tiers = await listTiersForEvent(id);
    const { tiers: tiersWithCapacity, capacity } = await enrichTiersWithCapacityStats(
      id,
      row.eventQuota,
      tiers,
    );
    return { ...row, tiers: tiersWithCapacity, capacity };
  }

  protected override async beforeCreate(
    data: Record<string, unknown>,
    _ctx?: ServiceContext,
  ): Promise<Record<string, unknown>> {
    return {
      ...data,
      slug: String(data.slug).trim().toLowerCase(),
      imageUrls: normalizeEventImageUrls(data.imageUrls),
      startsAt: parseStartsAt(data.startsAt as string | null | undefined),
      status: "draft",
    };
  }

  protected override async beforeUpdate(
    _id: string,
    data: Record<string, unknown>,
    _ctx?: ServiceContext,
  ): Promise<Record<string, unknown>> {
    return {
      ...data,
      ...(data.slug !== undefined
        ? { slug: String(data.slug).trim().toLowerCase() }
        : {}),
      ...(data.imageUrls !== undefined
        ? { imageUrls: normalizeEventImageUrls(data.imageUrls) }
        : {}),
      ...(data.startsAt !== undefined
        ? { startsAt: parseStartsAt(data.startsAt as string | null | undefined) }
        : {}),
    };
  }
}

export const eventsService = new EventsService();
