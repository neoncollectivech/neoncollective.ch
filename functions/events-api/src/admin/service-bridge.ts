import type { BulkServiceBridge, ListQuery, ListResult } from "@neon/admin-crud";

export type { ListQuery };

import type { ServiceContext } from "../services/base/types";
import { mapCtx } from "../services/base/map-ctx";

export type AdminServiceBridge = {
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

export function toBulkBridge(service: AdminServiceBridge): BulkServiceBridge {
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

