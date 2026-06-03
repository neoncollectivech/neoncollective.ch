import { eq } from "drizzle-orm";
import type { JWK } from "jose";

import { getDb } from "../db/index";
import { admissionSigningKeys } from "../db/schema";
import {
  admissionKidForEvent,
  generateEd25519AdmissionKeyPair,
} from "../helpers/admission-jwt";
import type { EntityTx } from "./transaction";

export { admissionSigningKeys as admissionSigningKeysTable };

export type AdmissionSigningKeyRow = typeof admissionSigningKeys.$inferSelect;

export class AdmissionSigningKeysService {
  async provisionForEvent(eventId: string, tx?: EntityTx): Promise<AdmissionSigningKeyRow> {
    const executor = tx ?? getDb();
    const [existing] = await executor
      .select()
      .from(admissionSigningKeys)
      .where(eq(admissionSigningKeys.eventId, eventId))
      .limit(1);

    if (existing) {
      return existing;
    }

    const material = await generateEd25519AdmissionKeyPair();
    const kid = admissionKidForEvent(eventId);
    const [inserted] = await executor
      .insert(admissionSigningKeys)
      .values({
        eventId,
        kid,
        algorithm: "EdDSA",
        publicJwk: material.publicJwk,
        privateJwk: material.privateJwk,
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to provision admission signing key.");
    }

    return inserted;
  }

  async getForEvent(eventId: string, tx?: EntityTx): Promise<{
    kid: string;
    publicJwk: JWK;
    privateJwk: JWK;
  } | null> {
    const executor = tx ?? getDb();
    const [row] = await executor
      .select()
      .from(admissionSigningKeys)
      .where(eq(admissionSigningKeys.eventId, eventId))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      kid: row.kid,
      publicJwk: row.publicJwk as JWK,
      privateJwk: row.privateJwk as JWK,
    };
  }

  async getPublicMetaForEvent(
    eventId: string,
    tx?: EntityTx,
  ): Promise<{ kid: string; createdAt: Date } | null> {
    const executor = tx ?? getDb();
    const [row] = await executor
      .select({
        kid: admissionSigningKeys.kid,
        createdAt: admissionSigningKeys.createdAt,
      })
      .from(admissionSigningKeys)
      .where(eq(admissionSigningKeys.eventId, eventId))
      .limit(1);

    return row ?? null;
  }

  getPublicJwksForEvent(row: Pick<AdmissionSigningKeyRow, "kid" | "publicJwk">): {
    keys: JWK[];
  } {
    const publicJwk = row.publicJwk as JWK;

    return {
      keys: [{ ...publicJwk, kid: row.kid, alg: "EdDSA", use: "sig" }],
    };
  }
}

export const admissionSigningKeysService = new AdmissionSigningKeysService();
