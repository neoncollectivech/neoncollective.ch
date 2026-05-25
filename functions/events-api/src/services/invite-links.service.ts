import { introspectTable } from "@neon/resource-api";
import { and, eq } from "drizzle-orm";

import { getDb } from "../db/index";
import { inviteLinks } from "../db/schema";
import type { EntityTx } from "./transaction";
import { randomTokenHex, sha256Hex } from "../helpers/token";
import { TableService } from "./base/table-service";

export { inviteLinks as inviteLinksTable };

export type InviteLinkTx = EntityTx;

export const inviteLinksResourceMeta = introspectTable(inviteLinks, {
  exclude: {
    list: ["tokenHash"],
    read: ["tokenHash"],
  },
  fields: {
    list: [
      "id",
      "eventId",
      "inviterId",
      "maxRedemptions",
      "token",
      "createdAt",
      "rotatedAt",
    ],
    read: [
      "id",
      "eventId",
      "inviterId",
      "maxRedemptions",
      "token",
      "createdAt",
      "rotatedAt",
    ],
  },
  list: { defaultSort: "-createdAt" },
});

export class InviteLinksService extends TableService<typeof inviteLinks> {
  constructor() {
    super({
      table: inviteLinks,
      meta: inviteLinksResourceMeta,
    });
  }

  async findByTokenHashInTx(
    tx: InviteLinkTx,
    tokenHash: string,
  ): Promise<typeof inviteLinks.$inferSelect | null> {
    const [row] = await tx
      .select()
      .from(inviteLinks)
      .where(eq(inviteLinks.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  async findByTokenHash(tokenHash: string): Promise<typeof inviteLinks.$inferSelect | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(inviteLinks)
      .where(eq(inviteLinks.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  async eventIdForLinkId(inviteLinkId: string, tx?: InviteLinkTx): Promise<string | null> {
    const executor = tx ?? getDb();
    const [row] = await executor
      .select({ eventId: inviteLinks.eventId })
      .from(inviteLinks)
      .where(eq(inviteLinks.id, inviteLinkId))
      .limit(1);
    return row?.eventId ?? null;
  }

  async getMaxRedemptions(inviteLinkId: string, tx?: InviteLinkTx): Promise<number | null> {
    const executor = tx ?? getDb();
    const [row] = await executor
      .select({ maxRedemptions: inviteLinks.maxRedemptions })
      .from(inviteLinks)
      .where(eq(inviteLinks.id, inviteLinkId))
      .limit(1);
    return row?.maxRedemptions ?? null;
  }

  async getInviterIdInTx(tx: InviteLinkTx, inviteLinkId: string): Promise<string | null> {
    const [link] = await tx
      .select({ inviterId: inviteLinks.inviterId })
      .from(inviteLinks)
      .where(eq(inviteLinks.id, inviteLinkId))
      .limit(1);
    return link?.inviterId ?? null;
  }

  async findHostLinkByEventAndPerson(
    eventId: string,
    personId: string,
  ): Promise<{ id: string; token: string; maxRedemptions: number } | null> {
    const db = getDb();
    const [row] = await db
      .select({
        id: inviteLinks.id,
        token: inviteLinks.token,
        maxRedemptions: inviteLinks.maxRedemptions,
      })
      .from(inviteLinks)
      .where(and(eq(inviteLinks.eventId, eventId), eq(inviteLinks.inviterId, personId)))
      .limit(1);
    return row ?? null;
  }

  async findHostLinkByEventAndPersonInTx(
    tx: InviteLinkTx,
    eventId: string,
    personId: string,
  ): Promise<{ id: string; token: string; maxRedemptions: number } | null> {
    const [row] = await tx
      .select({
        id: inviteLinks.id,
        token: inviteLinks.token,
        maxRedemptions: inviteLinks.maxRedemptions,
      })
      .from(inviteLinks)
      .where(and(eq(inviteLinks.eventId, eventId), eq(inviteLinks.inviterId, personId)))
      .limit(1);
    return row ?? null;
  }

  async listByEventId(eventId: string) {
    const db = getDb();
    return db
      .select({
        id: inviteLinks.id,
        inviterId: inviteLinks.inviterId,
        token: inviteLinks.token,
        maxRedemptions: inviteLinks.maxRedemptions,
        rotatedAt: inviteLinks.rotatedAt,
      })
      .from(inviteLinks)
      .where(eq(inviteLinks.eventId, eventId));
  }

  async listByEventIdInTx(
    tx: InviteLinkTx,
    eventId: string,
  ): Promise<
    {
      id: string;
      inviterId: string | null;
      token: string;
      maxRedemptions: number;
      rotatedAt: Date | null;
    }[]
  > {
    return tx
      .select({
        id: inviteLinks.id,
        inviterId: inviteLinks.inviterId,
        token: inviteLinks.token,
        maxRedemptions: inviteLinks.maxRedemptions,
        rotatedAt: inviteLinks.rotatedAt,
      })
      .from(inviteLinks)
      .where(eq(inviteLinks.eventId, eventId));
  }

  async insertHostLinkInTx(
    tx: InviteLinkTx,
    params: {
      eventId: string;
      personId: string;
      maxRedemptions: number;
      token: string;
      tokenHash: string;
    },
  ): Promise<void> {
    await tx.insert(inviteLinks).values({
      eventId: params.eventId,
      inviterId: params.personId,
      maxRedemptions: params.maxRedemptions,
      token: params.token,
      tokenHash: params.tokenHash,
    });
  }

  async updateHostLinkInTx(
    tx: InviteLinkTx,
    linkId: string,
    params: {
      token: string;
      tokenHash: string;
      maxRedemptions: number;
    },
  ): Promise<void> {
    await tx
      .update(inviteLinks)
      .set({
        token: params.token,
        tokenHash: params.tokenHash,
        maxRedemptions: params.maxRedemptions,
        rotatedAt: new Date(),
      })
      .where(eq(inviteLinks.id, linkId));
  }

  async updateMaxRedemptionsForLink(
    linkId: string,
    maxRedemptions: number,
  ): Promise<{ id: string; maxRedemptions: number }> {
    const db = getDb();
    const [updated] = await db
      .update(inviteLinks)
      .set({ maxRedemptions })
      .where(eq(inviteLinks.id, linkId))
      .returning({ id: inviteLinks.id, maxRedemptions: inviteLinks.maxRedemptions });
    return updated!;
  }

  async getHostLinkRow(
    eventId: string,
    linkId: string,
  ): Promise<{ id: string; inviterId: string | null; maxRedemptions: number } | null> {
    const db = getDb();
    const [link] = await db
      .select({
        id: inviteLinks.id,
        inviterId: inviteLinks.inviterId,
        maxRedemptions: inviteLinks.maxRedemptions,
      })
      .from(inviteLinks)
      .where(and(eq(inviteLinks.id, linkId), eq(inviteLinks.eventId, eventId)))
      .limit(1);
    return link ?? null;
  }

  async deleteById(linkId: string): Promise<void> {
    const db = getDb();
    await db.delete(inviteLinks).where(eq(inviteLinks.id, linkId));
  }

  async mintRawToken(): Promise<{ raw: string; tokenHash: string }> {
    const raw = randomTokenHex(24);
    return { raw, tokenHash: await sha256Hex(raw) };
  }
}

export const inviteLinksService = new InviteLinksService();
