import { createFactory } from "hono/factory";

import type { AppEnv } from "./env";

export const authFactory = createFactory<AppEnv>();
