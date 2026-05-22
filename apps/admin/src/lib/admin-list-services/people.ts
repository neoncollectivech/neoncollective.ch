import type { PersonRow } from "@/lib/admin-api";

import { queryOptions } from "@tanstack/react-query";

import { adminKeys } from "@/hooks/use-admin-api/keys";
import { listPeople } from "@/lib/admin-api";
import { buildAdminListQueryKey, pageToLimitSkip } from "@/lib/admin-list";

import { defineAdminListService, type AdminListQueryOptions } from "./types";

export type PeopleListFilters = {
  q?: string;
};

export const peopleListService = defineAdminListService<
  PersonRow,
  undefined,
  PeopleListFilters
>({
  id: "people",
  defaultSort: { field: "givenName", direction: "asc" },
  listQuery: ({ page, pageSize, sort, filters }) =>
    queryOptions({
      queryKey: [
        ...adminKeys.people.list(
          buildAdminListQueryKey(
            page,
            pageSize,
            filters?.q ? { q: filters.q } : undefined,
            sort,
          ),
        ),
        filters?.q ?? "",
      ],
      queryFn: () =>
        listPeople({
          ...pageToLimitSkip(page, pageSize),
          sort,
          ...(filters?.q ? { q: filters.q } : {}),
        }),
    }) as AdminListQueryOptions<PersonRow>,
});
