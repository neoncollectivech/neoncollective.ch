import type { ListResponse } from "@/lib/api-client";
import type { AdminFkServiceDefinition } from "@/lib/admin-fk-services";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  collectBatchIdsForFk,
  listParamsToQueryKey,
  toForeignKeyLookupMap,
  type ForeignKeyLookupRow,
  type ForeignKeyPresentation,
  type ForeignKeyScope,
  type ForeignKeySourceRow,
} from "@/lib/admin-fk-services";

const FK_STALE_MS = 60_000;

export type ForeignKeyLoading = {
  isPending: boolean;
  isFetching: boolean;
};

export type UseForeignKeyResult = {
  lookups: Partial<Record<string, Map<string, ForeignKeyLookupRow>>>;
  loading: Partial<Record<string, ForeignKeyLoading>>;
  presentation: Record<string, ForeignKeyPresentation>;
  href: (
    fk: AdminFkServiceDefinition,
    lookupId: string,
    row: ForeignKeyLookupRow | undefined,
  ) => string | undefined;
};

function useSingleFkQuery<TRow extends ForeignKeySourceRow>(
  fk: AdminFkServiceDefinition | undefined,
  rows: readonly TRow[],
  enabled: boolean,
  scope?: ForeignKeyScope,
  idKey?: string,
) {
  const ids = useMemo(
    () =>
      fk && enabled
        ? collectBatchIdsForFk(
            rows,
            fk,
            idKey as (keyof TRow & string) | undefined,
          )
        : [],
    [fk, enabled, rows, idKey],
  );
  const listParams = useMemo(
    () => (fk ? fk.buildListParams(ids, scope) : { limit: "1", skip: "0" }),
    [fk, ids, scope],
  );
  const queryKeyParams = useMemo(
    () => listParamsToQueryKey(listParams),
    [listParams],
  );
  const orderReady = !fk || fk.id !== "order" || Boolean(scope?.eventId);

  return useQuery<
    ListResponse<unknown>,
    Error,
    Map<string, ForeignKeyLookupRow>
  >({
    queryKey: [
      "admin-fk",
      fk?.id ?? null,
      queryKeyParams,
      listParams,
      idKey ?? null,
      fk?.list ?? null,
    ] as const,
    queryFn: () => fk!.list(listParams) as Promise<ListResponse<unknown>>,
    enabled: Boolean(fk) && enabled && orderReady && ids.length > 0,
    staleTime: FK_STALE_MS,
    placeholderData: (previous) => previous,
    select: (data) => toForeignKeyLookupMap(fk!, data.items),
  });
}

export function useForeignKey<TRow extends ForeignKeySourceRow>(config: {
  rows: readonly TRow[];
  load: readonly AdminFkServiceDefinition[];
  scope?: ForeignKeyScope;
  idKeysByFkId?: Partial<Record<string, string>>;
}): UseForeignKeyResult {
  const uniqueLoad = useMemo(() => {
    const seen = new Set<string>();

    return config.load.filter((fk) => {
      if (seen.has(fk.id)) {
        return false;
      }
      seen.add(fk.id);

      return true;
    });
  }, [config.load]);

  const eventFk = uniqueLoad.find((f) => f.id === "event");
  const personFk = uniqueLoad.find((f) => f.id === "person");
  const orderFk = uniqueLoad.find((f) => f.id === "order");

  const eventQuery = useSingleFkQuery(
    eventFk,
    config.rows,
    Boolean(eventFk),
    config.scope,
    config.idKeysByFkId?.event,
  );
  const personQuery = useSingleFkQuery(
    personFk,
    config.rows,
    Boolean(personFk),
    config.scope,
    config.idKeysByFkId?.person,
  );
  const orderQuery = useSingleFkQuery(
    orderFk,
    config.rows,
    Boolean(orderFk),
    config.scope,
    config.idKeysByFkId?.order,
  );

  const lookups: Partial<Record<string, Map<string, ForeignKeyLookupRow>>> = {};
  const loading: Partial<Record<string, ForeignKeyLoading>> = {};
  const presentation: Record<string, ForeignKeyPresentation> = {};

  if (eventFk) {
    lookups.event = eventQuery.data ?? new Map();
    loading.event = {
      isPending: eventQuery.isPending,
      isFetching: eventQuery.isFetching,
    };
    presentation.event = eventFk.presentation;
  }
  if (personFk) {
    lookups.person = personQuery.data ?? new Map();
    loading.person = {
      isPending: personQuery.isPending,
      isFetching: personQuery.isFetching,
    };
    presentation.person = personFk.presentation;
  }
  if (orderFk) {
    lookups.order = orderQuery.data ?? new Map();
    loading.order = {
      isPending: orderQuery.isPending,
      isFetching: orderQuery.isFetching,
    };
    presentation.order = orderFk.presentation;
  }

  return {
    lookups,
    loading,
    presentation,
    href: (fk, lookupId, row) => fk.href(lookupId, row),
  };
}
