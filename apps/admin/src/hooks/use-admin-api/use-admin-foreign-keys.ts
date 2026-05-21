import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { canonicalizeIds } from "@/lib/admin-list";

import { adminApi } from "./api";

type ForeignKeyRow = {
  eventId?: string | null;
  personId?: string | null;
};

export function useAdminForeignKeys<TRow extends ForeignKeyRow>(
  rows: readonly TRow[],
) {
  const eventIds = useMemo(
    () => canonicalizeIds(rows.map((row) => row.eventId ?? undefined)),
    [rows],
  );
  const personIds = useMemo(
    () => canonicalizeIds(rows.map((row) => row.personId ?? undefined)),
    [rows],
  );

  const eventsQuery = useQuery(adminApi.events.byIds(eventIds));
  const peopleQuery = useQuery(adminApi.people.byIds(personIds));

  return {
    eventById: eventsQuery.data ?? new Map<string, { title?: string }>(),
    personById:
      peopleQuery.data ??
      new Map<string, { givenName?: string; familyName?: string }>(),
    isPending: eventsQuery.isPending || peopleQuery.isPending,
    isFetching: eventsQuery.isFetching || peopleQuery.isFetching,
  };
}
