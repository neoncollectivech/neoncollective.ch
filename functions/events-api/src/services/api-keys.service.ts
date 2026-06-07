import { ConflictError, introspectTable, NotFoundError } from "@neon/resource-api";
import type { ServiceContext } from "@neon/resource-api";
import { and, desc, eq, isNull, or } from "drizzle-orm";

import { getDb } from "../db/index";
import { apiKeys } from "../db/schema";
import {
  defaultScopesForApiKey,
  normalizeApiKeyScopes,
  type ApiKeyScope,
} from "../config/api-keys";
import { randomTokenHex, sha256Hex } from "../helpers/token";
import { TableService } from "./base/table-service";
import { runTransaction } from "./transaction";

export { apiKeys as apiKeysTable };

const API_KEY_PREFIX = "neon_";
const KEY_PREFIX_DISPLAY_LEN = 13;

export type ApiKeyRow = typeof apiKeys.$inferSelect;

export type ApiKeyListItem = Pick<
  ApiKeyRow,
  | "id"
  | "eventId"
  | "label"
  | "keyPrefix"
  | "scopes"
  | "createdAt"
  | "revokedAt"
  | "lastUsedAt"
  | "createdByEmail"
>;

export const apiKeysResourceMeta = introspectTable(apiKeys, {
  exclude: { list: ["tokenHash"], read: ["tokenHash"] },
  fields: {
    list: [
      "id",
      "eventId",
      "label",
      "keyPrefix",
      "scopes",
      "createdAt",
      "revokedAt",
      "lastUsedAt",
      "createdByEmail",
    ],
  },
});

export class ApiKeysService extends TableService<typeof apiKeys> {
  constructor() {
    super({
      table: apiKeys,
      meta: apiKeysResourceMeta,
    });
  }

  async mint(params: {
    label: string;
    eventId: string | null;
    createdByEmail: string | null;
    scopes?: readonly ApiKeyScope[];
  }): Promise<{ row: ApiKeyListItem; rawToken: string }> {
    const rawToken = `${API_KEY_PREFIX}${randomTokenHex(24)}`;
    const tokenHash = await sha256Hex(rawToken);
    const keyPrefix = rawToken.slice(0, KEY_PREFIX_DISPLAY_LEN);
    const scopes = normalizeApiKeyScopes(
      params.scopes ?? defaultScopesForApiKey(params.eventId),
    );
    const db = getDb();
    const [row] = await db
      .insert(apiKeys)
      .values({
        label: params.label.trim(),
        eventId: params.eventId,
        tokenHash,
        keyPrefix,
        scopes,
        createdByEmail: params.createdByEmail,
      })
      .returning({
        id: apiKeys.id,
        eventId: apiKeys.eventId,
        label: apiKeys.label,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        createdAt: apiKeys.createdAt,
        revokedAt: apiKeys.revokedAt,
        lastUsedAt: apiKeys.lastUsedAt,
        createdByEmail: apiKeys.createdByEmail,
      });
    if (!row) {
      throw new Error("Failed to mint API key");
    }
    return { row, rawToken };
  }

  async findActiveByTokenHash(
    tokenHash: string,
  ): Promise<{ id: string; eventId: string | null; label: string; scopes: string[] } | null> {
    const db = getDb();
    const [row] = await db
      .select({
        id: apiKeys.id,
        eventId: apiKeys.eventId,
        label: apiKeys.label,
        scopes: apiKeys.scopes,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.tokenHash, tokenHash), isNull(apiKeys.revokedAt)))
      .limit(1);
    return row ?? null;
  }

  touchLastUsed(id: string): void {
    void getDb()
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, id))
      .catch(() => undefined);
  }

  async revoke(id: string): Promise<void> {
    const db = getDb();
    const [row] = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });
    if (!row) {
      throw new NotFoundError("API key not found.");
    }
  }

  async rotate(
    id: string,
    createdByEmail: string | null,
  ): Promise<{ row: ApiKeyListItem; rawToken: string }> {
    return runTransaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: apiKeys.id,
          eventId: apiKeys.eventId,
          label: apiKeys.label,
          scopes: apiKeys.scopes,
          revokedAt: apiKeys.revokedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.id, id))
        .limit(1);
      if (!existing) {
        throw new NotFoundError("API key not found.");
      }
      if (existing.revokedAt) {
        throw new ConflictError("Cannot rotate a revoked API key.");
      }

      await tx
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(eq(apiKeys.id, id));

      const rawToken = `${API_KEY_PREFIX}${randomTokenHex(24)}`;
      const tokenHash = await sha256Hex(rawToken);
      const keyPrefix = rawToken.slice(0, KEY_PREFIX_DISPLAY_LEN);
      const [row] = await tx
        .insert(apiKeys)
        .values({
          label: existing.label,
          eventId: existing.eventId,
          tokenHash,
          keyPrefix,
          scopes: existing.scopes,
          createdByEmail,
        })
        .returning({
          id: apiKeys.id,
          eventId: apiKeys.eventId,
          label: apiKeys.label,
          keyPrefix: apiKeys.keyPrefix,
          scopes: apiKeys.scopes,
          createdAt: apiKeys.createdAt,
          revokedAt: apiKeys.revokedAt,
          lastUsedAt: apiKeys.lastUsedAt,
          createdByEmail: apiKeys.createdByEmail,
        });
      if (!row) {
        throw new Error("Failed to rotate API key");
      }
      return { row, rawToken };
    });
  }

  protected override async beforeDelete(id: string, _ctx?: ServiceContext): Promise<void> {
    const db = getDb();
    const [row] = await db
      .select({ revokedAt: apiKeys.revokedAt })
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);
    if (!row) {
      return;
    }
    if (!row.revokedAt) {
      throw new ConflictError("Revoke the API key before deleting it.");
    }
  }

  async listAll(eventIdFilter?: string | null): Promise<ApiKeyListItem[]> {
    const db = getDb();
    if (eventIdFilter === undefined) {
      return db
        .select({
          id: apiKeys.id,
          eventId: apiKeys.eventId,
          label: apiKeys.label,
          keyPrefix: apiKeys.keyPrefix,
          scopes: apiKeys.scopes,
          createdAt: apiKeys.createdAt,
          revokedAt: apiKeys.revokedAt,
          lastUsedAt: apiKeys.lastUsedAt,
          createdByEmail: apiKeys.createdByEmail,
        })
        .from(apiKeys)
        .orderBy(desc(apiKeys.createdAt));
    }
    if (eventIdFilter === null) {
      return db
        .select({
          id: apiKeys.id,
          eventId: apiKeys.eventId,
          label: apiKeys.label,
          keyPrefix: apiKeys.keyPrefix,
          scopes: apiKeys.scopes,
          createdAt: apiKeys.createdAt,
          revokedAt: apiKeys.revokedAt,
          lastUsedAt: apiKeys.lastUsedAt,
          createdByEmail: apiKeys.createdByEmail,
        })
        .from(apiKeys)
        .where(isNull(apiKeys.eventId))
        .orderBy(desc(apiKeys.createdAt));
    }
    return this.listKeysForEvent(eventIdFilter);
  }

  /** Keys usable for a given event: global (null eventId) + scoped to that event. */
  async listKeysForEvent(eventId: string): Promise<ApiKeyListItem[]> {
    const db = getDb();
    return db
      .select({
        id: apiKeys.id,
        eventId: apiKeys.eventId,
        label: apiKeys.label,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        createdAt: apiKeys.createdAt,
        revokedAt: apiKeys.revokedAt,
        lastUsedAt: apiKeys.lastUsedAt,
        createdByEmail: apiKeys.createdByEmail,
      })
      .from(apiKeys)
      .where(or(isNull(apiKeys.eventId), eq(apiKeys.eventId, eventId)))
      .orderBy(desc(apiKeys.createdAt));
  }
}

export const apiKeysService = new ApiKeysService();

export function isApiKeyTokenFormat(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX) && token.length > API_KEY_PREFIX.length + 16;
}
