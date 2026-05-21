import { arktypeValidator } from "@hono/arktype-validator";
import {
  actionProvider,
  bulkProvider,
  buildArkTypeSchemas,
  crudProvider,
  detailProvider,
  introspectPgTable,
  listProvider,
  NotFoundError,
  parseListQuery,
  type CrudOperation,
} from "@neon/admin-crud";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import { getAdminCrudDb } from "../../services/admin/crud-mount";
import { mapCtx } from "../../services/base/map-ctx";
import { resolveAdminResource, type AdminResource } from "./resource";
import type { AdminServiceBridge } from "./service-bridge";
import { toBulkBridge } from "./service-bridge";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validate = arktypeValidator as (
  target: "json",
  schema: unknown,
) => MiddlewareHandler;

const DEFAULT_OPS: CrudOperation[] = ["list", "read", "create", "update", "delete"];

function resolveTableOperations(
  optsOps: CrudOperation[] | undefined,
  hasService: boolean,
  hasListOverride: boolean,
  hasDetailOverride: boolean,
): CrudOperation[] {
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
  svc: AdminServiceBridge,
  parent: { param: string; column: import("drizzle-orm/pg-core").PgColumn } | undefined,
  noMiddleware: MiddlewareHandler[],
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
  svc: AdminServiceBridge,
  def: ReturnType<typeof resolveAdminResource>,
  operations: CrudOperation[],
  noMiddleware: MiddlewareHandler[],
): void {
  if (!def.table) {
    return;
  }
  const builtSchemas = buildArkTypeSchemas(introspectPgTable(def.table, def.opts), def.opts?.schemas);
  const parent = def.opts?.parent;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = router as any;

  if (operations.includes("create") && svc.create && builtSchemas.create) {
    routes.post(
      "/",
      ...noMiddleware,
      validate("json", builtSchemas.create),
      async (c: import("@neon/admin-crud").AdminCrudContext) => {
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
      async (c: import("@neon/admin-crud").AdminCrudContext) => {
        const id = c.req.param("id")!;
        const body = (await c.req.json()) as Record<string, unknown>;
        try {
          await svc.update!(id, body, mapCtx(c, parent));
          const item = svc.getDetail
            ? await svc.getDetail(id, mapCtx(c, parent))
            : svc.get
              ? await svc.get(id, mapCtx(c, parent))
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
    routes.delete("/:id", ...noMiddleware, async (c: import("@neon/admin-crud").AdminCrudContext) => {
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
        service: toBulkBridge(svc),
      }),
    );
  }
}

export function createCrudRouter(resource: AdminResource): Hono {
  const def = resolveAdminResource(resource);
  const hasTable = def.table !== undefined;
  const hasService = def.service !== undefined;
  const hasListOverride = hasService || def.list !== undefined;
  const hasDetailOverride = hasService || def.detail !== undefined;

  if (!hasTable && !hasService && (!hasListOverride || !hasDetailOverride)) {
    throw new Error(
      "Admin resource without table must define service or both list and detail overrides.",
    );
  }

  const router = new Hono();
  const noMiddleware: never[] = [];
  const parent = def.opts?.parent;

  if (hasService && def.service) {
    mountServiceListDetail(router, def.service, parent, noMiddleware);
    if (hasTable) {
      const operations = resolveTableOperations(
        def.opts?.operations,
        true,
        true,
        true,
      );
      mountServiceMutations(router, def.service, def, operations, noMiddleware);
    }
  } else if (hasTable && def.table) {
    const operations = resolveTableOperations(
      def.opts?.operations,
      false,
      hasListOverride,
      hasDetailOverride,
    );
    router.route(
      "/",
      crudProvider(def.table, {
        ...def.opts,
        getDb: getAdminCrudDb,
        operations,
        middleware: noMiddleware,
      }),
    );
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
