import {
  readPersistedItem,
  removePersistedItem,
  writePersistedItem,
} from "@/lib/storage/persisted-storage";

const API_KEY_KEY = "neon:door:apiKey";
const KEY_LABEL_KEY = "neon:door:keyLabel";
const EVENT_ID_KEY = "neon:door:eventId";

export type DoorSessionConfig = {
  apiKey: string;
  keyLabel: string | null;
  eventId: string;
};

export function isApiKeyTokenFormat(token: string): boolean {
  const prefix = "neon_";

  return token.startsWith(prefix) && token.length > prefix.length + 16;
}

export function getDoorSessionConfig(): DoorSessionConfig | null {
  const apiKey = readPersistedItem(API_KEY_KEY)?.trim();
  const eventId = readPersistedItem(EVENT_ID_KEY)?.trim();

  if (!apiKey || !isApiKeyTokenFormat(apiKey) || !eventId) {
    return null;
  }

  return {
    apiKey,
    keyLabel: readPersistedItem(KEY_LABEL_KEY),
    eventId,
  };
}

export function setDoorSessionConfig(config: {
  apiKey: string;
  keyLabel?: string | null;
  eventId: string;
}): void {
  writePersistedItem(API_KEY_KEY, config.apiKey.trim());
  writePersistedItem(EVENT_ID_KEY, config.eventId.trim());

  if (config.keyLabel?.trim()) {
    writePersistedItem(KEY_LABEL_KEY, config.keyLabel.trim());
  } else {
    removePersistedItem(KEY_LABEL_KEY);
  }
}

export function clearDoorSessionConfig(): void {
  removePersistedItem(API_KEY_KEY);
  removePersistedItem(KEY_LABEL_KEY);
  removePersistedItem(EVENT_ID_KEY);
}
