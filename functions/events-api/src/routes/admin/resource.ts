import type {
  ActionDefinition,
  CrudOperation,
  CrudProviderOptions,
  DetailProviderHandler,
  ListProviderHandler,
} from "@neon/admin-crud";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import type { AdminServiceBridge } from "./service-bridge";

export type AdminResourceDef = {
  table?: PgTable;
  opts?: Omit<CrudProviderOptions, "middleware" | "getDb" | "operations"> & {
    operations?: CrudOperation[];
  };
  /** Typed entity service singleton (list/count/create/update/bulk). */
  service?: AdminServiceBridge;
  bulk?: { create?: boolean; update?: boolean };
  list?: ListProviderHandler;
  detail?: DetailProviderHandler;
  actions?: ActionDefinition[];
  extensions?: (middleware: MiddlewareHandler[]) => Hono[];
};

export type AdminResource = symbol & { readonly __adminResource?: unique symbol };

const registry = new Map<symbol, AdminResourceDef>();

export function defineAdminResource(def: AdminResourceDef): AdminResource {
  const token = Symbol("adminResource") as AdminResource;
  registry.set(token, def);
  return token;
}

export function resolveAdminResource(resource: AdminResource): AdminResourceDef {
  const def = registry.get(resource);
  if (!def) {
    throw new Error("Unknown admin resource — use defineAdminResource() to register.");
  }
  return def;
}
