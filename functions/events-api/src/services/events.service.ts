import {
  introspectTable,
  parseListQuery,
  type FilterParams,
  type ListQuery,
} from "@neon/resource-api";
import { and, eq, ilike, inArray } from "drizzle-orm";

import { events } from "../db/schema";
import type { PublicEventImage } from "./event-images.service";

export { events as eventsTable };
import { getDb } from "../db/index";
import { TableService } from "./base/table-service";
import type { ServiceContext } from "./base/types";
import type { EntityTx } from "./transaction";

export class InviteMechanismDisabledError extends Error {
  constructor(
    message = "Invites are only available for invite-only events.",
  ) {
    super(message);
    this.name = "InviteMechanismDisabledError";
  }
}

export type EventAccess = "full" | "minimal";

export type CatalogListRow = {
  slug: string;
  title: string;
  summary: string | null;
  location: string | null;
  images: PublicEventImage[];
  startsAt: Date | null;
  inviteOnly: boolean;
  registrationConfirmed: boolean;
};

export type CatalogListParams = {
  viewerPersonId: string | null;
  inviteEventId: string | null;
  /** When set, global key (eventId null) unlocks all invite-only events; scoped key unlocks one. */
  apiKeyEventId?: string | null;
  apiKeyIsGlobal?: boolean;
};

export type EventsListFilters = FilterParams;

export const eventsResourceMeta = introspectTable(events, {
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
    read: [
      "id",
      "slug",
      "title",
      "summary",
      "location",
      "startsAt",
      "status",
      "accessMode",
      "eventQuota",
      "defaultInviteLinkMaxRedemptions",
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
      meta: eventsResourceMeta,
      defaultSort: "-startsAt",
    });
  }

  parseListQuery(raw: Record<string, string | string[] | undefined>): ListQuery<EventsListFilters> {
    return parseListQuery<EventsListFilters>(raw);
  }

  async getInTx(tx: EntityTx, eventId: string): Promise<typeof events.$inferSelect | null> {
    const [row] = await tx.select().from(events).where(eq(events.id, eventId)).limit(1);
    return row ?? null;
  }

  /** Throws when the event exists but `access_mode` is not `invite_only`. */
  async requireInviteOnly(eventId: string): Promise<void> {
    const row = await this.get(eventId);
    if (!row) {
      return;
    }
    if (row.accessMode !== "invite_only") {
      throw new InviteMechanismDisabledError();
    }
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

  async getPublishedBySlugInTx(
    tx: EntityTx,
    slug: string,
  ): Promise<typeof events.$inferSelect | null> {
    const [row] = await tx
      .select()
      .from(events)
      .where(and(eq(events.slug, slug), eq(events.status, "published")))
      .limit(1);
    return row ?? null;
  }

  async getByIds(ids: string[]): Promise<(typeof events.$inferSelect)[]> {
    if (ids.length === 0) {
      return [];
    }
    const db = getDb();
    return db.select().from(events).where(inArray(events.id, ids));
  }

  async searchIdsByTitle(term: string): Promise<string[]> {
    const q = term.trim();
    if (!q) {
      return [];
    }
    const db = getDb();
    const rows = await db
      .select({ id: events.id })
      .from(events)
      .where(ilike(events.title, `%${q}%`));
    return rows.map((r) => r.id);
  }

  async listPublishedPublicCatalogRows(): Promise<
    Pick<
      typeof events.$inferSelect,
      "id" | "slug" | "title" | "summary" | "location" | "startsAt"
    >[]
  > {
    const db = getDb();
    return db
      .select({
        id: events.id,
        slug: events.slug,
        title: events.title,
        summary: events.summary,
        location: events.location,
        startsAt: events.startsAt,
      })
      .from(events)
      .where(and(eq(events.status, "published"), eq(events.accessMode, "public")));
  }

  async listPublishedInviteOnlyCatalogRows(): Promise<
    Pick<
      typeof events.$inferSelect,
      "id" | "slug" | "title" | "summary" | "location" | "startsAt"
    >[]
  > {
    const db = getDb();
    return db
      .select({
        id: events.id,
        slug: events.slug,
        title: events.title,
        summary: events.summary,
        location: events.location,
        startsAt: events.startsAt,
      })
      .from(events)
      .where(
        and(eq(events.status, "published"), eq(events.accessMode, "invite_only")),
      );
  }

  async getPublishedInviteOnlyById(
    eventId: string,
  ): Promise<
    Pick<
      typeof events.$inferSelect,
      "id" | "slug" | "title" | "summary" | "location" | "startsAt"
    > | null
  > {
    const db = getDb();
    const [row] = await db
      .select({
        id: events.id,
        slug: events.slug,
        title: events.title,
        summary: events.summary,
        location: events.location,
        startsAt: events.startsAt,
      })
      .from(events)
      .where(
        and(
          eq(events.id, eventId),
          eq(events.status, "published"),
          eq(events.accessMode, "invite_only"),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async hasAnyPublishedAmongIds(eventIds: string[]): Promise<boolean> {
    if (eventIds.length === 0) {
      return false;
    }
    const rows = await this.getByIds(eventIds);
    return rows.some((e) => e.status === "published");
  }

  protected override async beforeCreate(
    data: Record<string, unknown>,
    _ctx?: ServiceContext,
  ): Promise<Record<string, unknown>> {
    return {
      ...data,
      slug: String(data.slug).trim().toLowerCase(),
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
      ...(data.startsAt !== undefined
        ? { startsAt: parseStartsAt(data.startsAt as string | null | undefined) }
        : {}),
    };
  }
}

export const eventsService = new EventsService();
