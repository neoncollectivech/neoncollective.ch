import type { ListResponse } from "@/lib/api-client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  collectBatchIds,
  FK_SERVICE_REGISTRY,
  listParamsToQueryKey,
  toForeignKeyLookupMap,
  type ForeignKeyLookupRow,
  type ForeignKeyPresentation,
  type ForeignKeyScope,
  type ForeignKeyService,
  type ForeignKeySourceRow,
} from "@/lib/foreign-key-registry";

import { adminKeys } from "./use-admin-api/keys";

const FK_STALE_MS = 60_000;

export type ForeignKeyLoading = {
  isPending: boolean;
  isFetching: boolean;
};

export type UseForeignKeyResult = {
  lookups: Partial<Record<ForeignKeyService, Map<string, ForeignKeyLookupRow>>>;
  loading: Partial<Record<ForeignKeyService, ForeignKeyLoading>>;
  presentation: Record<ForeignKeyService, ForeignKeyPresentation>;
  href: (
    service: ForeignKeyService,
    lookupId: string,
    row: ForeignKeyLookupRow | undefined,
  ) => string | undefined;
};

function fkListQueryKey(
  service: ForeignKeyService,
  params: Record<string, string>,
): readonly unknown[] {
  switch (service) {
    case "event":
      return adminKeys.events.list(params);
    case "person":
      return adminKeys.people.list(params);
    case "order":
      return adminKeys.orders.list(params);
  }
}

function useEventForeignKeyQuery<TRow extends ForeignKeySourceRow>(
  rows: readonly TRow[],
  enabled: boolean,
) {
  const entry = FK_SERVICE_REGISTRY.event;
  const ids = useMemo(
    () => (enabled ? collectBatchIds(rows, "event") : []),
    [enabled, rows],
  );
  const listParams = useMemo(() => entry.buildListParams(ids), [entry, ids]);
  const queryKeyParams = useMemo(
    () => listParamsToQueryKey(listParams),
    [listParams],
  );

  return useQuery<
    ListResponse<unknown>,
    Error,
    Map<string, ForeignKeyLookupRow>
  >({
    queryKey: [...fkListQueryKey("event", queryKeyParams), listParams] as const,
    queryFn: () => entry.list(listParams) as Promise<ListResponse<unknown>>,
    enabled: enabled && ids.length > 0,
    staleTime: FK_STALE_MS,
    placeholderData: (previous) => previous,
    select: (data) => toForeignKeyLookupMap("event", data.items),
  });
}

function usePersonForeignKeyQuery<TRow extends ForeignKeySourceRow>(
  rows: readonly TRow[],
  enabled: boolean,
) {
  const entry = FK_SERVICE_REGISTRY.person;
  const ids = useMemo(
    () => (enabled ? collectBatchIds(rows, "person") : []),
    [enabled, rows],
  );
  const listParams = useMemo(() => entry.buildListParams(ids), [entry, ids]);
  const queryKeyParams = useMemo(
    () => listParamsToQueryKey(listParams),
    [listParams],
  );

  return useQuery<
    ListResponse<unknown>,
    Error,
    Map<string, ForeignKeyLookupRow>
  >({
    queryKey: [
      ...fkListQueryKey("person", queryKeyParams),
      listParams,
    ] as const,
    queryFn: () => entry.list(listParams) as Promise<ListResponse<unknown>>,
    enabled: enabled && ids.length > 0,
    staleTime: FK_STALE_MS,
    placeholderData: (previous) => previous,
    select: (data) => toForeignKeyLookupMap("person", data.items),
  });
}

function useOrderForeignKeyQuery<TRow extends ForeignKeySourceRow>(
  rows: readonly TRow[],
  enabled: boolean,
  scope?: ForeignKeyScope,
) {
  const entry = FK_SERVICE_REGISTRY.order;
  const ids = useMemo(
    () => (enabled ? collectBatchIds(rows, "order") : []),
    [enabled, rows],
  );
  const listParams = useMemo(
    () => entry.buildListParams(ids, scope),
    [entry, ids, scope],
  );
  const queryKeyParams = useMemo(
    () => listParamsToQueryKey(listParams),
    [listParams],
  );
  const orderReady = Boolean(scope?.eventId);

  return useQuery<
    ListResponse<unknown>,
    Error,
    Map<string, ForeignKeyLookupRow>
  >({
    queryKey: [...fkListQueryKey("order", queryKeyParams), listParams] as const,
    queryFn: () => entry.list(listParams) as Promise<ListResponse<unknown>>,
    enabled: enabled && orderReady && ids.length > 0,
    staleTime: FK_STALE_MS,
    placeholderData: (previous) => previous,
    select: (data) => toForeignKeyLookupMap("order", data.items),
  });
}

export function useForeignKey<TRow extends ForeignKeySourceRow>(config: {
  rows: readonly TRow[];
  load: readonly ForeignKeyService[];
  scope?: ForeignKeyScope;
}): UseForeignKeyResult {
  const loadSet = useMemo(() => new Set(config.load), [config.load]);

  const eventQuery = useEventForeignKeyQuery(config.rows, loadSet.has("event"));
  const personQuery = usePersonForeignKeyQuery(
    config.rows,
    loadSet.has("person"),
  );
  const orderQuery = useOrderForeignKeyQuery(
    config.rows,
    loadSet.has("order"),
    config.scope,
  );

  const lookups: Partial<
    Record<ForeignKeyService, Map<string, ForeignKeyLookupRow>>
  > = {};
  const loading: Partial<Record<ForeignKeyService, ForeignKeyLoading>> = {};

  if (loadSet.has("event")) {
    lookups.event = eventQuery.data ?? new Map();
    loading.event = {
      isPending: eventQuery.isPending,
      isFetching: eventQuery.isFetching,
    };
  }
  if (loadSet.has("person")) {
    lookups.person = personQuery.data ?? new Map();
    loading.person = {
      isPending: personQuery.isPending,
      isFetching: personQuery.isFetching,
    };
  }
  if (loadSet.has("order")) {
    lookups.order = orderQuery.data ?? new Map();
    loading.order = {
      isPending: orderQuery.isPending,
      isFetching: orderQuery.isFetching,
    };
  }

  return {
    lookups,
    loading,
    presentation: {
      event: FK_SERVICE_REGISTRY.event.presentation,
      person: FK_SERVICE_REGISTRY.person.presentation,
      order: FK_SERVICE_REGISTRY.order.presentation,
    },
    href: (service, lookupId, row) =>
      FK_SERVICE_REGISTRY[service].href(lookupId, row),
  };
}
