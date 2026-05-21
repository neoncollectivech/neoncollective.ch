import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import type { AdminEnv } from "../auth/require-admin-session";

export function adminRoute(
  admin: Hono<AdminEnv>,
  path: string,
  subApp: Hono,
  ...middleware: MiddlewareHandler[]
): void {
  const shell = new Hono();
  shell.use("*", ...middleware);
  shell.route("/", subApp);
  admin.route(path, shell);
}
