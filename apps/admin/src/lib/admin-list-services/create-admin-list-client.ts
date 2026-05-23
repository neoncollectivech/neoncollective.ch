import type { AdminListRequestParams } from "@/lib/admin-api";
import type { ListResponse } from "@/lib/api-client";

import { api } from "@/lib/api-client";

/** CRUD list GET helper for `/admin/{resource}` endpoints. */
export function createAdminListClient<TRow>(path: string) {
  return async function listResource(
    params: AdminListRequestParams,
  ): Promise<ListResponse<TRow>> {
    const res = await api.get<ListResponse<TRow>>(path, { params });

    return res.data;
  };
}
