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
  const apiKey = sessionStorage.getItem(API_KEY_KEY)?.trim();

  if (!apiKey || !isApiKeyTokenFormat(apiKey)) {
    return null;
  }

  return {
    apiKey,
    keyLabel: sessionStorage.getItem(KEY_LABEL_KEY),
  };
}

export function setDoorSessionConfig(config: {
  apiKey: string;
  keyLabel?: string | null;
}): void {
  sessionStorage.setItem(API_KEY_KEY, config.apiKey.trim());
  if (config.keyLabel?.trim()) {
    sessionStorage.setItem(KEY_LABEL_KEY, config.keyLabel.trim());
  } else {
    sessionStorage.removeItem(KEY_LABEL_KEY);
  }
}

export function clearDoorSessionConfig(): void {
  sessionStorage.removeItem(API_KEY_KEY);
  sessionStorage.removeItem(KEY_LABEL_KEY);
}
