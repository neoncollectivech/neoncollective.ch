import { type } from "arktype";

/** Shared list query params for admin CRUD list endpoints (HTTP query strings). */
export const adminListQuerySchema = type({
  "page?": "string",
  "pageSize?": "string",
  "sort?": "string",
  "q?": "string",
});

export type AdminListQuery = {
  page?: string;
  pageSize?: string;
  sort?: string;
  q?: string;
};

export function parseAdminListQuery(query: AdminListQuery & Record<string, string | undefined>): {
  page: number;
  pageSize: number;
  sort?: string;
  q?: string;
} {
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize ?? "20", 10) || 20));
  return {
    page,
    pageSize,
    sort: query.sort,
    q: query.q,
  };
}

export type AdminListMeta = {
  page: number;
  pageSize: number;
  total: number;
};
