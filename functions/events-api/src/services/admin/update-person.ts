import { and, eq, ne } from "drizzle-orm";
import { BadRequestError, ConflictError, NotFoundError } from "@neon/admin-crud";

import { normalizeEmailTypo, phoneToStoredDigits } from "../../contact.js";
import { getDb } from "../../db/index.js";
import { people } from "../../db/schema.js";
export type AdminPersonUpdateInput = {
  givenName?: string;
  familyName?: string;
  email?: string | null;
  phoneE164?: string | null;
};

function normalizeEmail(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  return normalizeEmailTypo(trimmed).toLowerCase();
}

/** Merge PATCH body with existing row; validates contact + uniqueness. */
export async function prepareAdminPersonUpdate(
  personId: string,
  patch: AdminPersonUpdateInput,
): Promise<Record<string, unknown>> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);

  if (!existing) {
    throw new NotFoundError("Person not found.");
  }

  const givenName =
    patch.givenName !== undefined ? patch.givenName.trim() : existing.givenName;
  const familyName =
    patch.familyName !== undefined ? patch.familyName.trim() : existing.familyName;

  if (!givenName || !familyName) {
    throw new BadRequestError("Given name and family name are required.");
  }

  const email =
    patch.email !== undefined ? normalizeEmail(patch.email) : existing.email;

  let phone = existing.phone;
  if (patch.phoneE164 !== undefined) {
    const raw = patch.phoneE164?.trim() ?? "";
    if (!raw) {
      phone = null;
    } else {
      const digits = phoneToStoredDigits(raw);
      if (!digits) {
        throw new BadRequestError("Invalid phone number.");
      }
      phone = digits;
    }
  }

  if (!email && !phone) {
    throw new BadRequestError("Email or phone is required.");
  }

  if (email) {
    const [conflict] = await db
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.email, email), ne(people.id, personId)))
      .limit(1);
    if (conflict) {
      throw new ConflictError("Another person already uses this email.");
    }
  }

  if (phone) {
    const [conflict] = await db
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.phone, phone), ne(people.id, personId)))
      .limit(1);
    if (conflict) {
      throw new ConflictError("Another person already uses this phone number.");
    }
  }

  const emailChanged = patch.email !== undefined && email !== existing.email;
  const phoneChanged = patch.phoneE164 !== undefined && phone !== existing.phone;

  let emailVerifiedAt = existing.emailVerifiedAt;
  let phoneVerifiedAt = existing.phoneVerifiedAt;

  if (emailChanged) {
    emailVerifiedAt = email ? null : null;
  }
  if (phoneChanged) {
    phoneVerifiedAt = phone ? null : null;
  }
  if (!email) {
    emailVerifiedAt = null;
  }
  if (!phone) {
    phoneVerifiedAt = null;
  }

  return {
    givenName,
    familyName,
    email,
    phone,
    emailVerifiedAt,
    phoneVerifiedAt,
    updatedAt: new Date(),
  };
}
