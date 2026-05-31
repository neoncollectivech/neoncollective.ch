import { BadRequestError, ConflictError, NotFoundError } from "@neon/resource-api";
import { and, asc, eq, inArray } from "drizzle-orm";

import {
  isAllowedEventImageContentType,
  MAX_EVENT_IMAGE_BYTES,
  MAX_EVENT_IMAGES_PER_EVENT,
} from "../config/event-images";
import { eventImages } from "../db/schema";
import { getDb } from "../db/index";
import {
  buildPublicUrl,
  isR2Configured,
  isValidEventImageStorageKey,
} from "../helpers/r2-storage";

export { eventImages as eventImagesTable };

export type EventImageDto = {
  id: string;
  eventId: string;
  storageKey: string;
  url: string;
  contentType: string;
  byteSize: number;
  sortOrder: number;
  altText: string | null;
  createdAt: Date;
};

export type EventImageCreateInput = {
  storageKey: string;
  contentType: string;
  byteSize: number;
  altText?: string | null;
};

function toDto(row: typeof eventImages.$inferSelect): EventImageDto {
  return {
    id: row.id,
    eventId: row.eventId,
    storageKey: row.storageKey,
    url: isR2Configured() ? buildPublicUrl(row.storageKey) : "",
    contentType: row.contentType,
    byteSize: row.byteSize,
    sortOrder: row.sortOrder,
    altText: row.altText,
    createdAt: row.createdAt,
  };
}

function validateCreateInput(
  eventId: string,
  data: EventImageCreateInput,
  existingCount: number,
): void {
  if (!isValidEventImageStorageKey(eventId, data.storageKey)) {
    throw new BadRequestError("Invalid storage key for this event.");
  }
  if (!isAllowedEventImageContentType(data.contentType)) {
    throw new BadRequestError("Unsupported image content type.");
  }
  if (data.byteSize <= 0 || data.byteSize > MAX_EVENT_IMAGE_BYTES) {
    throw new BadRequestError("Image exceeds the maximum allowed size.");
  }
  if (existingCount >= MAX_EVENT_IMAGES_PER_EVENT) {
    throw new ConflictError(
      `An event may have at most ${MAX_EVENT_IMAGES_PER_EVENT} images.`,
    );
  }
}

export class EventImagesService {
  async listByEventId(eventId: string): Promise<EventImageDto[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(eventImages)
      .where(eq(eventImages.eventId, eventId))
      .orderBy(asc(eventImages.sortOrder), asc(eventImages.createdAt));
    return rows.map(toDto);
  }

  async listPublicUrlsByEventId(eventId: string): Promise<string[]> {
    const images = await this.listByEventId(eventId);
    return images.map((img) => img.url);
  }

  async listPublicUrlsByEventIds(
    eventIds: string[],
  ): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    for (const id of eventIds) {
      result.set(id, []);
    }
    if (eventIds.length === 0) {
      return result;
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(eventImages)
      .where(inArray(eventImages.eventId, eventIds))
      .orderBy(asc(eventImages.sortOrder), asc(eventImages.createdAt));

    for (const row of rows) {
      const list = result.get(row.eventId) ?? [];
      if (isR2Configured()) {
        list.push(buildPublicUrl(row.storageKey));
      }
      result.set(row.eventId, list);
    }
    return result;
  }

  async createForEvent(
    eventId: string,
    data: EventImageCreateInput,
  ): Promise<EventImageDto> {
    const db = getDb();
    const existing = await db
      .select({ sortOrder: eventImages.sortOrder })
      .from(eventImages)
      .where(eq(eventImages.eventId, eventId));
    validateCreateInput(eventId, data, existing.length);

    const sortOrder =
      existing.length > 0
        ? Math.max(...existing.map((r) => r.sortOrder)) + 1
        : 0;

    try {
      const [row] = await db
        .insert(eventImages)
        .values({
          eventId,
          storageKey: data.storageKey,
          contentType: data.contentType,
          byteSize: data.byteSize,
          sortOrder,
          altText: data.altText?.trim() || null,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create event image row.");
      }
      return toDto(row);
    } catch (e) {
      if (
        e instanceof Error &&
        "code" in e &&
        (e as { code?: string }).code === "23505"
      ) {
        throw new ConflictError("This image was already registered.");
      }
      throw e;
    }
  }

  async reorderForEvent(
    eventId: string,
    imageIds: string[],
  ): Promise<EventImageDto[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(eventImages)
      .where(eq(eventImages.eventId, eventId));

    if (imageIds.length !== rows.length) {
      throw new BadRequestError("Reorder must include every image for the event.");
    }

    const rowById = new Map(rows.map((r) => [r.id, r]));
    for (const id of imageIds) {
      if (!rowById.has(id)) {
        throw new BadRequestError("Unknown image id for this event.");
      }
    }

    await db.transaction(async (tx) => {
      for (let i = 0; i < imageIds.length; i++) {
        await tx
          .update(eventImages)
          .set({ sortOrder: i })
          .where(
            and(
              eq(eventImages.id, imageIds[i]!),
              eq(eventImages.eventId, eventId),
            ),
          );
      }
    });

    return this.listByEventId(eventId);
  }

  async getForEvent(
    eventId: string,
    imageId: string,
  ): Promise<EventImageDto | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(eventImages)
      .where(
        and(eq(eventImages.id, imageId), eq(eventImages.eventId, eventId)),
      )
      .limit(1);
    return row ? toDto(row) : null;
  }

  async deleteForEvent(eventId: string, imageId: string): Promise<EventImageDto> {
    const existing = await this.getForEvent(eventId, imageId);
    if (!existing) {
      throw new NotFoundError("Event image not found.");
    }

    const db = getDb();
    await db
      .delete(eventImages)
      .where(
        and(eq(eventImages.id, imageId), eq(eventImages.eventId, eventId)),
      );

    return existing;
  }
}

export const eventImagesService = new EventImagesService();
