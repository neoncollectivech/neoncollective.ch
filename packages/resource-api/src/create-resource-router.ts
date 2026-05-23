import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { PgColumn } from "drizzle-orm/pg-core";

import { actionProvider } from "./action-provider";
import { buildArkTypeSchemas } from "./arktype-from-columns";
import { bulkProvider } from "./bulk-provider";
import { detailProvider } from "./detail-provider";
import { introspectTable, type ResourceMeta } from "./introspect";
import { listProvider } from "./list-provider";
import { NotFoundError } from "./errors";
import { parseListQuery } from "./list-scope";
import { resolveResource, type Resource, type ResourceDef } from "./resource";
import {
  toBulkBridge,
  type MapCtxFn,
  type ServiceBridge,
} from "./table-service-bridge";
import type { ResourceContext, ResourceOperation } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validate = arktypeValidator as (
  target: "json",
  schema: unknown,
) => MiddlewareHandler;

const DEFAULT_OPS: ResourceOperation[] = ["list", "read", "create", "update", "delete"];

export type CreateResourceRouterOptions = {
  mapCtx: MapCtxFn;
};

function resolveResourceMeta(def: ResourceDef): ResourceMeta {
  if (def.meta) {
    return def.meta;
  }
  if (def.table) {
    return introspectTable(def.table, def.opts);
  }
  throw new Error("Resource requires meta or table for schema resolution.");
}

function resolveTableOperations(
  optsOps: ResourceOperation[] | undefined,
  hasService: boolean,
  hasListOverride: boolean,
  hasDetailOverride: boolean,
): ResourceOperation[] {
  const base = optsOps ?? DEFAULT_OPS;
  return base.filter((op) => {
    if ((hasService || hasListOverride) && op === "list") {
      return false;
    }
    if ((hasService || hasDetailOverride) && op === "read") {
      return false;
    }
    return true;
  });
}

function mountServiceListDetail(
  router: Hono,
  svc: ServiceBridge,
  parent: { param: string; column: PgColumn } | undefined,
  noMiddleware: MiddlewareHandler[],
  mapCtx: MapCtxFn,
): void {
  router.route(
    "/",
    listProvider(async (c) => {
      const raw = c.req.query() as Record<string, string | string[] | undefined>;
      const query = svc.parseListQuery ? svc.parseListQuery(raw) : parseListQuery(raw);
      return svc.list(query, mapCtx(c, parent));
    }, noMiddleware),
  );

  router.route(
    "/",
    detailProvider(async (id, c) => {
      const ctx = mapCtx(c, parent);
      const row = svc.getDetail
        ? await svc.getDetail(id, ctx)
        : svc.get
          ? await svc.get(id, ctx)
          : null;
      return row ?? null;
    }, noMiddleware),
  );
}

function mountServiceMutations(
  router: Hono,
  svc: ServiceBridge,
  def: ResourceDef,
  operations: ResourceOperation[],
  noMiddleware: MiddlewareHandler[],
  mapCtx: MapCtxFn,
): void {
  if (!def.table) {
    return;
  }
  const meta = def.meta ?? def.service?.meta ?? resolveResourceMeta(def);
  const builtSchemas = buildArkTypeSchemas(meta, def.opts?.schemas);
  const parent = def.opts?.parent;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = router as any;

  if (operations.includes("create") && svc.create && builtSchemas.create) {
    routes.post(
      "/",
      ...noMiddleware,
      validate("json", builtSchemas.create),
      async (c: ResourceContext) => {
        const body = (await c.req.json()) as Record<string, unknown>;
        const item = await svc.create!(body, mapCtx(c, parent));
        return c.json({ item }, 201);
      },
    );
  }

  if (operations.includes("update") && svc.update && builtSchemas.update) {
    routes.patch(
      "/:id",
      ...noMiddleware,
      validate("json", builtSchemas.update),
      async (c: ResourceContext) => {
        const id = c.req.param("id")!;
        const body = (await c.req.json()) as Record<string, unknown>;
        try {
          await svc.update!(id, body, mapCtx(c, parent));
          const ctx = mapCtx(c, parent);
          const item = svc.getDetail
            ? await svc.getDetail(id, ctx)
            : svc.get
              ? await svc.get(id, ctx)
              : null;
          if (!item) {
            return c.json({ error: "Not found." }, 404);
          }
          return c.json({ item });
        } catch (e) {
          if (e instanceof NotFoundError) {
            return c.json({ error: e.message }, 404);
          }
          throw e;
        }
      },
    );
  }

  if (operations.includes("delete") && svc.delete) {
    routes.delete("/:id", ...noMiddleware, async (c: ResourceContext) => {
      const id = c.req.param("id")!;
      try {
        await svc.delete!(id, mapCtx(c, parent));
        return c.body(null, 204);
      } catch (e) {
        if (e instanceof NotFoundError) {
          return c.json({ error: e.message }, 404);
        }
        throw e;
      }
    });
  }

  if (def.bulk?.create || def.bulk?.update) {
    router.route(
      "/",
      bulkProvider({
        create: def.bulk.create,
        update: def.bulk.update,
        createSchema: builtSchemas.create,
        updateSchema: builtSchemas.update,
        middleware: noMiddleware,
        service: toBulkBridge(svc, mapCtx),
      }),
    );
  }
}

export function createResourceRouter(
  resource: Resource,
  options: CreateResourceRouterOptions,
): Hono {
  const def = resolveResource(resource);
  const hasTable = def.table !== undefined;
  const hasService = def.service !== undefined;
  const hasListOverride = hasService || def.list !== undefined;
  const hasDetailOverride = hasService || def.detail !== undefined;

  if (!hasTable && !hasService && (!hasListOverride || !hasDetailOverride)) {
    throw new Error(
      "Resource without table must define service or both list and detail overrides.",
    );
  }

  if (!hasService) {
    throw new Error(
      "Resource requires a service bridge — crudProvider fallback was removed.",
    );
  }

  const router = new Hono();
  const noMiddleware: never[] = [];
  const parent = def.opts?.parent;
  const { mapCtx } = options;

  if (def.service) {
    mountServiceListDetail(router, def.service, parent, noMiddleware, mapCtx);
    if (hasTable) {
      const operations = resolveTableOperations(def.opts?.operations, true, true, true);
      mountServiceMutations(router, def.service, def, operations, noMiddleware, mapCtx);
    }
  }

  if (!hasService && hasListOverride && def.list) {
    router.route("/", listProvider(def.list, noMiddleware));
  }

  if (!hasService && hasDetailOverride && def.detail) {
    router.route("/", detailProvider(def.detail, noMiddleware));
  }

  if (def.actions?.length) {
    router.route("/", actionProvider(def.actions, noMiddleware));
  }

  if (def.extensions) {
    for (const extension of def.extensions(noMiddleware)) {
      router.route("/", extension);
    }
  }

  return router;
}

export type ComposeResourceRouterOptions = CreateResourceRouterOptions & {
  resource: Resource;
  control?: Hono;
};

export function composeResourceRouter(options: ComposeResourceRouterOptions): Hono {
  const router = new Hono();
  router.route("/", createResourceRouter(options.resource, { mapCtx: options.mapCtx }));
  if (options.control) {
    router.route("/", options.control);
  }
  return router;
}
