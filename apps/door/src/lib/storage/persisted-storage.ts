/**
 * Door PWA persistence via localStorage (survives refresh and PWA restarts on venue tablets).
 * One-time migration from legacy sessionStorage keys written during a brief security experiment.
 */

function migrateFromSessionStorage(key: string): string | null {
  const session = sessionStorage.getItem(key);

  if (session === null) {
    return null;
  }

  localStorage.setItem(key, session);
  sessionStorage.removeItem(key);

  return session;
}

export function readPersistedItem(key: string): string | null {
  const stored = localStorage.getItem(key);

  if (stored !== null) {
    return stored;
  }

  return migrateFromSessionStorage(key);
}

export function writePersistedItem(key: string, value: string): void {
  localStorage.setItem(key, value);
  sessionStorage.removeItem(key);
}

export function removePersistedItem(key: string): void {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}
