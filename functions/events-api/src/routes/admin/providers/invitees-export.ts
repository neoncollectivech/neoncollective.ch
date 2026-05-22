import type { AdminCrudContext } from "@neon/admin-crud";
import { stringify } from "csv/sync";

import { MAX_INVITEE_EXPORT_ROWS } from "../../../config/admin-invitees";
import { e164FromStoredDigits } from "../../../helpers/profile";
import {
  buildPublicLoginUrl,
  resolveLoginContact,
} from "../../../helpers/public-login-url";
import { eventInviteesService } from "../../../services/event-invitees.service";

type InviteeRow = Awaited<
  ReturnType<typeof eventInviteesService.selectAllForAdminScope>
>[number];
import {
  InviteMechanismDisabledError,
  eventsService,
} from "../../../services/events.service";
import { ordersService } from "../../../services/orders.service";
import { peopleService } from "../../../services/people.service";

import { resolveInviteesAdminListScope } from "./invitees-list-scope";

const EXPORT_COLUMNS = [
  "givenName",
  "familyName",
  "email",
  "phoneE164",
  "loginLink",
  "notes",
  "inviteeStatus",
  "orderStatus",
  "personId",
  "inviteeId",
] as const;

type ExportRow = Record<(typeof EXPORT_COLUMNS)[number], string>;

function inviteeStatusLabel(row: {
  revokedAt: Date | null;
  personId: string | null;
}): string {
  if (row.revokedAt) {
    return "Revoked";
  }
  if (!row.personId) {
    return "Profile pending";
  }

  return "Active";
}

function mapExportRow(
  invitee: InviteeRow,
  person: {
    givenName: string;
    familyName: string;
    email: string | null;
    phone: string | null;
  } | null,
  orderStatus: string,
): ExportRow {
  const pendingEmail = invitee.email;
  const pendingPhone = invitee.phone;
  const email = person?.email ?? pendingEmail;
  const phoneE164 = e164FromStoredDigits(person?.phone ?? pendingPhone ?? null);
  const loginContact = resolveLoginContact({
    email: email?.trim() ? email.trim() : null,
    phoneE164,
  });

  return {
    givenName: person?.givenName ?? "",
    familyName: person?.familyName ?? "",
    email: email ?? "",
    phoneE164: phoneE164 ?? "",
    loginLink: loginContact ? buildPublicLoginUrl(loginContact) : "",
    notes: invitee.notes ?? "",
    inviteeStatus: inviteeStatusLabel(invitee),
    orderStatus,
    personId: invitee.personId ?? "",
    inviteeId: invitee.id,
  };
}

export async function exportEventInviteesCsv(c: AdminCrudContext) {
  const eventId = c.req.param("eventId")?.trim();

  if (!eventId) {
    return c.json({ error: "Event id required." }, 400);
  }

  try {
    await eventsService.requireInviteOnly(eventId);
  } catch (e) {
    if (e instanceof InviteMechanismDisabledError) {
      return c.json({ error: e.message }, 403);
    }
    throw e;
  }

  const raw = c.req.query() as Record<string, string | string[] | undefined>;
  const { scope } = resolveInviteesAdminListScope(raw, { eventId });

  const total = await eventInviteesService.countForAdminScope(scope);

  if (total > MAX_INVITEE_EXPORT_ROWS) {
    return c.json(
      {
        error: `Export exceeds ${MAX_INVITEE_EXPORT_ROWS} invitees; narrow filters.`,
      },
      413,
    );
  }

  const invitees = await eventInviteesService.selectAllForAdminScope(scope);

  const personIds = [
    ...new Set(
      invitees
        .map((row) => row.personId)
        .filter((id): id is string => id != null),
    ),
  ];

  const peopleById = new Map<
    string,
    { givenName: string; familyName: string; email: string | null; phone: string | null }
  >();

  if (personIds.length > 0) {
    const peopleResult = await peopleService.list({
      limit: personIds.length,
      skip: 0,
      filters: { id_in: personIds },
    });

    for (const person of peopleResult.items) {
      peopleById.set(person.id, {
        givenName: person.givenName,
        familyName: person.familyName,
        email: person.email,
        phone: person.phone,
      });
    }
  }

  const orderStatusByPersonId = new Map<string, string>();

  if (personIds.length > 0) {
    const ordersResult = await ordersService.list({
      limit: personIds.length,
      skip: 0,
      sort: "-createdAt",
      filters: {
        eventId,
        personId_in: personIds,
      },
    });

    for (const order of ordersResult.items) {
      if (!orderStatusByPersonId.has(order.personId)) {
        orderStatusByPersonId.set(order.personId, order.status);
      }
    }
  }

  const csvRows = invitees.map((invitee) =>
    mapExportRow(
      invitee,
      invitee.personId ? peopleById.get(invitee.personId) ?? null : null,
      invitee.personId
        ? orderStatusByPersonId.get(invitee.personId) ?? ""
        : "",
    ),
  );

  const csv = stringify(csvRows, {
    header: true,
    columns: [...EXPORT_COLUMNS],
  });

  const event = await eventsService.get(eventId);
  const slug = event?.slug?.trim() || eventId;
  const filename = `${slug}-invitees.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
