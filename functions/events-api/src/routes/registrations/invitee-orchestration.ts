import { e164FromStoredDigits } from "../../helpers/profile";
import { eventsService } from "../../services/events.service";
import { eventInviteesService } from "../../services/event-invitees.service";

export async function findPublishedOrphanInviteeId(
  contact: { kind: "email"; email: string } | { kind: "phone"; e164: string },
): Promise<string | undefined> {
  const inviteeId = await eventInviteesService.findOrphanInviteeIdByContact(contact);
  if (!inviteeId) {
    return undefined;
  }
  const loaded = await loadPublishedOrphanInviteeContact(inviteeId);
  return loaded ? inviteeId : undefined;
}

export async function loadPublishedOrphanInviteeContact(
  inviteeId: string,
): Promise<{ email: string | null; phoneE164: string | null } | null> {
  const row = await eventInviteesService.get(inviteeId);
  if (!row) {
    return null;
  }
  if (row.personId || row.revokedAt) {
    return null;
  }
  const ev = await eventsService.get(row.eventId);
  if (!ev || ev.status !== "published") {
    return null;
  }
  return {
    email: row.email?.trim().toLowerCase() ?? null,
    phoneE164: row.phone ? e164FromStoredDigits(row.phone) : null,
  };
}
