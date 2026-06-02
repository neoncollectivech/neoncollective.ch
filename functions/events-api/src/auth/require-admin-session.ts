export type { AdminSession } from "./resolvers/admin-session";
export { requireAdminSession } from "./middleware/assert";

/** @deprecated Use AppEnv from ./env */
export type AdminEnv = {
  Variables: {
    adminSession: import("./resolvers/admin-session").AdminSession;
  };
};
