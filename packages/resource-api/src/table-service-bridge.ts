import type { ListQuery, ListResult } from "./list-scope";
import type { ResourceMeta } from "./introspect";
import { projectRow } from "./row-utils";
import type { ServiceContext } from "./service-context";

export type ServiceBridge = {
  meta?: ResourceMeta;
  list(
    query: ListQuery<Record<string, unknown>>,
    ctx: ServiceContext,
  ): Promise<ListResult<unknown>>;
  count?(query: ListQuery<Record<string, unknown>>, ctx: ServiceContext): Promise<number>;
  get?(id: string, ctx: ServiceContext): Promise<unknown | null>;
  getDetail?(id: string, ctx: ServiceContext): Promise<unknown | null>;
  create?(data: Record<string, unknown>, ctx: ServiceContext): Promise<unknown>;
  createBulk?(items: Record<string, unknown>[], ctx: ServiceContext): Promise<unknown[]>;
  update?(
    id: string,
    data: Record<string, unknown>,
    ctx: ServiceContext,
  ): Promise<unknown>;
  updateBulk?(
    updates: { id: string; data: Record<string, unknown> }[],
    ctx: ServiceContext,
  ): Promise<unknown[]>;
  delete?(id: string, ctx: ServiceContext): Promise<void>;
  parseListQuery?: (
    raw: Record<string, string | string[] | undefined>,
  ) => ListQuery<Record<string, unknown>>;
  filterMeta?: { filterable: readonly { name: string }[] };
};

export type TableServiceBridge = ServiceBridge & {
  meta: ResourceMeta;
};

type TableServiceLike = {
  resourceMeta: ResourceMeta;
  list(
    query: ListQuery<Record<string, unknown>>,
    ctx?: ServiceContext,
  ): Promise<ListResult<unknown>>;
  count(query: ListQuery<Record<string, unknown>>, ctx?: ServiceContext): Promise<number>;
  getForAdmin(id: string, ctx?: ServiceContext): Promise<Record<string, unknown> | null>;
  create(data: Record<string, unknown>, ctx?: ServiceContext): Promise<unknown>;
  createBulk(items: Record<string, unknown>[], ctx?: ServiceContext): Promise<unknown[]>;
  update(id: string, data: Record<string, unknown>, ctx?: ServiceContext): Promise<unknown>;
  updateBulk(
    updates: { id: string; data: Record<string, unknown> }[],
    ctx?: ServiceContext,
  ): Promise<unknown[]>;
  delete(id: string, ctx?: ServiceContext): Promise<void>;
  parseListQuery?(
    raw: Record<string, string | string[] | undefined>,
  ): ListQuery<Record<string, unknown>>;
};

function serviceMeta(svc: TableServiceLike): ResourceMeta {
  return svc.resourceMeta;
}

function projectRead(
  svc: TableServiceLike,
  row: unknown,
): Record<string, unknown> {
  if (!row || typeof row !== "object") {
    return row as Record<string, unknown>;
  }
  const readProject = serviceMeta(svc).project.read;
  if (readProject === "*") {
    return row as Record<string, unknown>;
  }
  return projectRow(row as Record<string, unknown>, readProject);
}

export function tableServiceToBridge(svc: TableServiceLike): TableServiceBridge {
  const meta = serviceMeta(svc);
  return {
    meta,
    list: (query, ctx) => svc.list(query, ctx) as Promise<ListResult<unknown>>,
    count: (query, ctx) => svc.count(query, ctx),
    get: (id, ctx) => svc.getForAdmin(id, ctx),
    getDetail: (id, ctx) => svc.getForAdmin(id, ctx),
    create: async (data, ctx) => {
      const row = await svc.create(data, ctx);
      return projectRead(svc, row);
    },
    createBulk: async (items, ctx) => {
      const rows = await svc.createBulk(items, ctx);
      return rows.map((row) => projectRead(svc, row));
    },
    update: async (id, data, ctx) => {
      const row = await svc.update(id, data, ctx);
      return projectRead(svc, row);
    },
    updateBulk: async (updates, ctx) => {
      const rows = await svc.updateBulk(updates, ctx);
      return rows.map((row) => projectRead(svc, row));
    },
    delete: (id, ctx) => svc.delete(id, ctx),
    parseListQuery: svc.parseListQuery?.bind(svc),
    filterMeta: { filterable: meta.filterable },
  };
}

export type MapCtxFn = (
  c: import("./types").ResourceContext,
  parent?: { param: string; column: import("drizzle-orm/pg-core").PgColumn },
) => ServiceContext;

export function toBulkBridge(
  service: ServiceBridge,
  mapCtx: MapCtxFn,
): import("./bulk-provider").BulkServiceBridge {
  return {
    createBulk: service.createBulk
      ? async (items, c) =>
          (await service.createBulk!(items, mapCtx(c))) as Record<string, unknown>[]
      : undefined,
    updateBulk: service.updateBulk
      ? async (updates, c) =>
          (await service.updateBulk!(updates, mapCtx(c))) as Record<string, unknown>[]
      : undefined,
  };
}
