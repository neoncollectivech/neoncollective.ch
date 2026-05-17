/** Vite `base` without trailing slash; empty string when base is `/`. */
export const adminBasename = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Absolute app URL for a route segment (e.g. `events` → `/admin/events` on GitHub Pages). */
export function adminAbsoluteUrl(path: string): string {
  const segment = path.replace(/^\//, "");
  const base = import.meta.env.BASE_URL;

  return new URL(segment, window.location.origin + base).href;
}
