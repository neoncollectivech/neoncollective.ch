import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import type { AppEnv } from "../../auth/env";

export function adminRoute(
  admin: Hono<AppEnv>,
  path: string,
  subApp: Hono,
  ...middleware: MiddlewareHandler[]
): void {
  const shell = new Hono();
  shell.use("*", ...middleware);
  shell.route("/", subApp);
  admin.route(path, shell);
}
