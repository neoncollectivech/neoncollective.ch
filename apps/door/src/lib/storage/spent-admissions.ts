import {
  readPersistedItem,
  writePersistedItem,
} from "@/lib/storage/persisted-storage";

function storageKey(eventId: string): string {
  return `neon:door:spent:${eventId}`;
}

export function readSpentAdmissionIds(eventId: string): Set<string> {
  const raw = readPersistedItem(storageKey(eventId));

  if (!raw) {
    return new Set();
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function markAdmissionSpentLocally(
  eventId: string,
  admissionId: string,
): void {
  const spent = readSpentAdmissionIds(eventId);

  spent.add(admissionId);
  writePersistedItem(storageKey(eventId), JSON.stringify([...spent]));
}

export function isAdmissionSpentLocally(
  eventId: string,
  admissionId: string,
): boolean {
  return readSpentAdmissionIds(eventId).has(admissionId);
}

export function clearAllSpentAdmissionsForEvent(eventId: string): void {
  writePersistedItem(storageKey(eventId), JSON.stringify([]));
}
