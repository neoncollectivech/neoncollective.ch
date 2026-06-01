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

export type EventImageFocal = { x: number; y: number };

export type PublicEventImage = {
  url: string;
  focal: EventImageFocal | null;
};

export type EventImageDto = {
  id: string;
  eventId: string;
  storageKey: string;
  url: string;
  contentType: string;
  byteSize: number;
  sortOrder: number;
  altText: string | null;
  focalX: number | null;
  focalY: number | null;
  createdAt: Date;
};

export type EventImageCreateInput = {
  storageKey: string;
  contentType: string;
  byteSize: number;
  altText?: string | null;
};

function focalFromRow(
  focalX: number | null,
  focalY: number | null,
): EventImageFocal | null {
  if (focalX == null || focalY == null) {
    return null;
  }

  return { x: focalX, y: focalY };
}

function toPublicImage(row: typeof eventImages.$inferSelect): PublicEventImage {
  return {
    url: isR2Configured() ? buildPublicUrl(row.storageKey) : "",
    focal: focalFromRow(row.focalX, row.focalY),
  };
}

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
    focalX: row.focalX,
    focalY: row.focalY,
    createdAt: row.createdAt,
  };
}

function validateFocalInput(focal: EventImageFocal | null): void {
  if (focal === null) {
    return;
  }
  if (
    !Number.isInteger(focal.x) ||
    focal.x < 0 ||
    focal.x > 100 ||
    !Number.isInteger(focal.y) ||
    focal.y < 0 ||
    focal.y > 100
  ) {
    throw new BadRequestError("Focal point must use integers from 0 to 100.");
  }
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

  async listPublicImagesByEventId(eventId: string): Promise<PublicEventImage[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(eventImages)
      .where(eq(eventImages.eventId, eventId))
      .orderBy(asc(eventImages.sortOrder), asc(eventImages.createdAt));
    return rows.map(toPublicImage);
  }

  async listPublicImagesByEventIds(
    eventIds: string[],
  ): Promise<Map<string, PublicEventImage[]>> {
    const result = new Map<string, PublicEventImage[]>();
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
      list.push(toPublicImage(row));
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

  async updateFocalForEvent(
    eventId: string,
    imageId: string,
    focal: EventImageFocal | null,
  ): Promise<EventImageDto> {
    validateFocalInput(focal);

    const existing = await this.getForEvent(eventId, imageId);
    if (!existing) {
      throw new NotFoundError("Event image not found.");
    }

    const db = getDb();
    const [row] = await db
      .update(eventImages)
      .set({
        focalX: focal?.x ?? null,
        focalY: focal?.y ?? null,
      })
      .where(
        and(eq(eventImages.id, imageId), eq(eventImages.eventId, eventId)),
      )
      .returning();

    if (!row) {
      throw new NotFoundError("Event image not found.");
    }

    return toDto(row);
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
