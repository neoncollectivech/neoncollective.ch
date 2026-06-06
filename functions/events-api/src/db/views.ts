import { eq } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";

import { admissions, eventRegistrations, people } from "./schema";

/**
 * Admin list read model: admission row + registration person identity.
 * Change the query here, then run `pnpm db:events-api:generate` (never hand-edit view SQL).
 */
export const admissionsAdminListView = pgView("admissions_admin_list").as((qb) =>
  qb
    .select({
      id: admissions.id,
      registrationId: admissions.registrationId,
      eventId: admissions.eventId,
      signedCredential: admissions.signedCredential,
      checkedInAt: admissions.checkedInAt,
      checkedInBy: admissions.checkedInBy,
      revokedAt: admissions.revokedAt,
      createdAt: admissions.createdAt,
      personId: eventRegistrations.personId,
      givenName: people.givenName,
      familyName: people.familyName,
    })
    .from(admissions)
    .innerJoin(
      eventRegistrations,
      eq(admissions.registrationId, eventRegistrations.id),
    )
    .innerJoin(people, eq(eventRegistrations.personId, people.id)),
);
