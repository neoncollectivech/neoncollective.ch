import {
  readPersistedItem,
  removePersistedItem,
  writePersistedItem,
} from "@/lib/storage/persisted-storage";

const API_KEY_KEY = "neon:door:apiKey";
const KEY_LABEL_KEY = "neon:door:keyLabel";

export type DoorSessionConfig = {
  apiKey: string;
  keyLabel: string | null;
};

export function isApiKeyTokenFormat(token: string): boolean {
  const prefix = "neon_";

  return token.startsWith(prefix) && token.length > prefix.length + 16;
}

export function getDoorSessionConfig(): DoorSessionConfig | null {
  const apiKey = readPersistedItem(API_KEY_KEY)?.trim();

  if (!apiKey || !isApiKeyTokenFormat(apiKey)) {
    return null;
  }

  return {
    apiKey,
    keyLabel: readPersistedItem(KEY_LABEL_KEY),
  };
}

export function setDoorSessionConfig(config: {
  apiKey: string;
  keyLabel?: string | null;
}): void {
  writePersistedItem(API_KEY_KEY, config.apiKey.trim());

  if (config.keyLabel?.trim()) {
    writePersistedItem(KEY_LABEL_KEY, config.keyLabel.trim());
  } else {
    removePersistedItem(KEY_LABEL_KEY);
  }
}

export function clearDoorSessionConfig(): void {
  removePersistedItem(API_KEY_KEY);
  removePersistedItem(KEY_LABEL_KEY);
}
