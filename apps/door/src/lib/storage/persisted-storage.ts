/**
 * Door PWA persistence via localStorage (survives app restarts).
 * Migrates one-time from legacy sessionStorage keys.
 */

function migrateFromSession(key: string): string | null {
  const legacy = sessionStorage.getItem(key);

  if (legacy === null) {
    return null;
  }

  localStorage.setItem(key, legacy);
  sessionStorage.removeItem(key);

  return legacy;
}

export function readPersistedItem(key: string): string | null {
  const local = localStorage.getItem(key);

  if (local !== null) {
    return local;
  }

  return migrateFromSession(key);
}

export function writePersistedItem(key: string, value: string): void {
  localStorage.setItem(key, value);
  sessionStorage.removeItem(key);
}

export function removePersistedItem(key: string): void {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}
