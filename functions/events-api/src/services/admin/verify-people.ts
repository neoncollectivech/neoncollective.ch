import { eq, inArray } from "drizzle-orm";

import { getDb } from "../../db/index.js";
import { people } from "../../db/schema.js";
import {
  isEmailVerified,
  isPhoneVerified,
  personHasEmailField,
  personHasPhoneField,
} from "../../profile.js";

export type VerifyPeopleSummary = {
  updated: number;
  skipped: number;
  notFound: number;
};

/** Admin: mark present email/phone channels as verified (no OTP). */
export async function verifyPeopleBulk(personIds: string[]): Promise<VerifyPeopleSummary> {
  const uniqueIds = [...new Set(personIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { updated: 0, skipped: 0, notFound: 0 };
  }

  const db = getDb();
  const now = new Date();
  const rows = await db
    .select()
    .from(people)
    .where(inArray(people.id, uniqueIds));

  let updated = 0;
  let skipped = 0;

  for (const person of rows) {
    if (!personHasEmailField(person) && !personHasPhoneField(person)) {
      skipped++;
      continue;
    }

    const patch: {
      emailVerifiedAt?: Date;
      phoneVerifiedAt?: Date;
      updatedAt: Date;
    } = { updatedAt: now };
    let changed = false;

    if (personHasEmailField(person) && !isEmailVerified(person)) {
      patch.emailVerifiedAt = now;
      changed = true;
    }
    if (personHasPhoneField(person) && !isPhoneVerified(person)) {
      patch.phoneVerifiedAt = now;
      changed = true;
    }

    if (!changed) {
      skipped++;
      continue;
    }

    await db.update(people).set(patch).where(eq(people.id, person.id));
    updated++;
  }

  const foundIds = new Set(rows.map((r) => r.id));
  const notFound = uniqueIds.filter((id) => !foundIds.has(id)).length;

  return { updated, skipped, notFound };
}
