import { type } from "arktype";

/** Shared list query params for admin CRUD list endpoints (HTTP query strings). */
export const adminListQuerySchema = type({
  "limit?": "string",
  "skip?": "string",
  "sort?": "string",
  "q?": "string",
});

export type AdminListQuery = {
  limit?: string;
  skip?: string;
  sort?: string;
  q?: string;
};

export type AdminListMeta = {
  total: number;
  limit: number;
  skip: number;
};
