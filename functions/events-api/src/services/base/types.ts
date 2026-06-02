import type { ResourceContext } from "@neon/resource-api";
import type { ServiceContext as BaseServiceContext, ServiceParent } from "@neon/resource-api";

import type { AdminSession } from "../../auth/resolvers/admin-session";

export type { ServiceParent };

export type ServiceContext = BaseServiceContext & {
  hono?: ResourceContext;
  adminSession?: AdminSession;
};

export type ListWhereHook = (
  ctx?: ServiceContext,
) => import("drizzle-orm").SQL | undefined | Promise<import("drizzle-orm").SQL | undefined>;
