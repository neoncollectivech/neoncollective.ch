const DEFAULT_DEV_ADMIN_EMAIL = "dev@neonclub.ch";

/** Vite dev only — production builds ignore VITE_ADMIN_AUTH_DISABLED. */
export function isAdminAuthDisabled(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }
  const flag = import.meta.env.VITE_ADMIN_AUTH_DISABLED?.trim();
  return flag === "1" || flag === "true";
}

export function devAdminDisplayEmail(): string {
  const email = import.meta.env.VITE_ADMIN_AUTH_DEV_EMAIL?.trim();
  return email && email.length > 0 ? email : DEFAULT_DEV_ADMIN_EMAIL;
}
