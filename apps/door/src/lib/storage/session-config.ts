import {
  readPersistedItem,
  removePersistedItem,
  writePersistedItem,
} from "@/lib/storage/persisted-storage";

const API_KEY_KEY = "neon:door:apiKey";
const KEY_LABEL_KEY = "neon:door:keyLabel";
const EVENT_ID_KEY = "neon:door:eventId";
const EVENT_TITLE_KEY = "neon:door:eventTitle";
const READER_ID_KEY = "neon:door:readerId";
const READER_NAME_KEY = "neon:door:readerName";

export type DoorSessionConfig = {
  apiKey: string;
  keyLabel: string | null;
  eventId: string;
  eventTitle: string | null;
  readerId: string | null;
  readerName: string | null;
};

export type DoorApiKeyConfig = {
  apiKey: string;
  keyLabel: string | null;
};

export function isApiKeyTokenFormat(token: string): boolean {
  const prefix = "neon_";

  return token.startsWith(prefix) && token.length > prefix.length + 16;
}

export function getDoorApiKeyConfig(): DoorApiKeyConfig | null {
  const apiKey = readPersistedItem(API_KEY_KEY)?.trim();

  if (!apiKey || !isApiKeyTokenFormat(apiKey)) {
    return null;
  }

  return {
    apiKey,
    keyLabel: readPersistedItem(KEY_LABEL_KEY),
  };
}

export function getDoorSessionConfig(): DoorSessionConfig | null {
  const keyConfig = getDoorApiKeyConfig();
  const eventId = readPersistedItem(EVENT_ID_KEY)?.trim();

  if (!keyConfig || !eventId) {
    return null;
  }

  return {
    ...keyConfig,
    eventId,
    eventTitle: readPersistedItem(EVENT_TITLE_KEY),
    readerId: readPersistedItem(READER_ID_KEY),
    readerName: readPersistedItem(READER_NAME_KEY),
  };
}

export function setDoorReaderConfig(config: {
  readerId: string;
  readerName?: string | null;
}): void {
  writePersistedItem(READER_ID_KEY, config.readerId.trim());
  if (config.readerName?.trim()) {
    writePersistedItem(READER_NAME_KEY, config.readerName.trim());
  } else {
    removePersistedItem(READER_NAME_KEY);
  }
}

export function clearDoorReaderConfig(): void {
  removePersistedItem(READER_ID_KEY);
  removePersistedItem(READER_NAME_KEY);
}

/** Saves API key (and optional label) before an event is chosen. */
export function setDoorApiKeyConfig(config: {
  apiKey: string;
  keyLabel?: string | null;
}): void {
  writePersistedItem(API_KEY_KEY, config.apiKey.trim());
  removePersistedItem(EVENT_ID_KEY);
  removePersistedItem(EVENT_TITLE_KEY);

  if (config.keyLabel?.trim()) {
    writePersistedItem(KEY_LABEL_KEY, config.keyLabel.trim());
  } else {
    removePersistedItem(KEY_LABEL_KEY);
  }
}

export function setDoorSessionConfig(config: {
  apiKey: string;
  keyLabel?: string | null;
  eventId: string;
  eventTitle?: string | null;
}): void {
  writePersistedItem(API_KEY_KEY, config.apiKey.trim());
  writePersistedItem(EVENT_ID_KEY, config.eventId.trim());

  if (config.keyLabel?.trim()) {
    writePersistedItem(KEY_LABEL_KEY, config.keyLabel.trim());
  } else {
    removePersistedItem(KEY_LABEL_KEY);
  }

  if (config.eventTitle?.trim()) {
    writePersistedItem(EVENT_TITLE_KEY, config.eventTitle.trim());
  } else {
    removePersistedItem(EVENT_TITLE_KEY);
  }
}

/** Keeps API key; clears event so the picker can run again. */
export function clearDoorEventSelection(): void {
  removePersistedItem(EVENT_ID_KEY);
  removePersistedItem(EVENT_TITLE_KEY);
}

export function clearDoorSessionConfig(): void {
  removePersistedItem(API_KEY_KEY);
  removePersistedItem(KEY_LABEL_KEY);
  removePersistedItem(EVENT_ID_KEY);
  removePersistedItem(EVENT_TITLE_KEY);
  clearDoorReaderConfig();
}
