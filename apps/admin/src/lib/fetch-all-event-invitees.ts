import type { EventInviteeListRow } from "@/lib/admin-api";

import { listEventInvitees } from "@/lib/admin-api";

const PAGE_SIZE = 100;
const MAX_INVITEES = 10_000;

export class InviteeTreeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InviteeTreeFetchError";
  }
}

export async function fetchAllEventInvitees(
  eventId: string,
): Promise<EventInviteeListRow[]> {
  const first = await listEventInvitees({
    eventId,
    limit: String(PAGE_SIZE),
    skip: "0",
    sort: "createdAt",
  });

  if (first.meta.total > MAX_INVITEES) {
    throw new InviteeTreeFetchError(
      `Too many invitees (${first.meta.total}) to render the tree. Use the list view with filters.`,
    );
  }

  const rows = [...first.items];
  let skip = PAGE_SIZE;

  while (skip < first.meta.total) {
    const page = await listEventInvitees({
      eventId,
      limit: String(PAGE_SIZE),
      skip: String(skip),
      sort: "createdAt",
    });

    rows.push(...page.items);
    skip += PAGE_SIZE;
  }

  return rows;
}
