const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export type ListScopeQuery = {
  limit: number;
  skip: number;
  checkedIn?: boolean;
};

export function parseListScopeQuery(
  query: Record<string, string | string[] | undefined>,
): ListScopeQuery {
  const limitRaw = typeof query.limit === "string" ? query.limit : undefined;
  const skipRaw = typeof query.skip === "string" ? query.skip : undefined;
  const checkedInRaw =
    typeof query.checkedIn === "string" ? query.checkedIn : undefined;

  const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : DEFAULT_LIMIT;
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const parsedSkip = skipRaw ? Number.parseInt(skipRaw, 10) : 0;
  const skip = Number.isFinite(parsedSkip) ? Math.max(parsedSkip, 0) : 0;

  const checkedIn =
    checkedInRaw === "true" ? true : checkedInRaw === "false" ? false : undefined;

  return { limit, skip, checkedIn };
}
