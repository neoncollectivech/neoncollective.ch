/**
 * Door PWA persistence via sessionStorage (survives refresh, cleared when tab closes).
 * Migrates one-time from legacy localStorage keys.
 */

function migrateFromLocalStorage(key: string): string | null {
  const legacy = localStorage.getItem(key);

  if (legacy === null) {
    return null;
  }

  sessionStorage.setItem(key, legacy);
  localStorage.removeItem(key);

  return legacy;
}

export function readPersistedItem(key: string): string | null {
  const session = sessionStorage.getItem(key);

  if (session !== null) {
    return session;
  }

  return migrateFromLocalStorage(key);
}

export function writePersistedItem(key: string, value: string): void {
  sessionStorage.setItem(key, value);
  localStorage.removeItem(key);
}

export function removePersistedItem(key: string): void {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}
