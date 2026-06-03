import type { ActionDefinition } from "./action-provider";
import type {
  ResourceOperation,
  ResourceProviderOptions,
} from "./types";
import type { ResourceMeta } from "./introspect";
import type { DetailProviderHandler } from "./detail-provider";
import type { ListProviderHandler } from "./list-provider";
import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { PgQueryable } from "./pg-queryable";

import type { ServiceBridge } from "./table-service-bridge";

export type ResourceDef = {
  table?: PgQueryable;
  meta?: ResourceMeta;
  opts?: Omit<ResourceProviderOptions, "operations"> & {
    operations?: ResourceOperation[];
  };
  /** Typed entity service singleton (list/count/create/update/bulk). */
  service?: ServiceBridge;
  bulk?: { create?: boolean; update?: boolean };
  list?: ListProviderHandler;
  detail?: DetailProviderHandler;
  actions?: ActionDefinition[];
  extensions?: (middleware: MiddlewareHandler[]) => Hono[];
};

export type Resource = symbol & { readonly __resource?: unique symbol };

const registry = new Map<symbol, ResourceDef>();

export function defineResource(def: ResourceDef): Resource {
  const token = Symbol("resource") as Resource;
  registry.set(token, def);
  return token;
}

export function resolveResource(resource: Resource): ResourceDef {
  const def = registry.get(resource);
  if (!def) {
    throw new Error("Unknown resource — use defineResource() to register.");
  }
  return def;
}
