/** Vite `base` without trailing slash (e.g. `/door` or `` for `/`). */
export const doorBasename = import.meta.env.BASE_URL.replace(/\/$/, "");
