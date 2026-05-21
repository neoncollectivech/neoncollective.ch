import type { ListQuery, ListResult } from "@neon/admin-crud";

import type { ServiceContext } from "./types";

export abstract class AbstractService<
  TFilters extends Record<string, unknown> = Record<string, never>,
  TListItem = unknown,
> {
  constructor() {
    if (new.target === AbstractService) {
      throw new Error("AbstractService cannot be instantiated directly.");
    }
  }

  abstract list(query: ListQuery<TFilters>, ctx?: ServiceContext): Promise<ListResult<TListItem>>;
  abstract count(query: ListQuery<TFilters>, ctx?: ServiceContext): Promise<number>;
}
