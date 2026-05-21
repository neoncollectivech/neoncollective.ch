import { or, type SQL } from "drizzle-orm";

/** Combine SQL fragments with OR; returns null when empty. */
export function orClauses(clauses: SQL[]): SQL | null {
  if (clauses.length === 0) {
    return null;
  }
  if (clauses.length === 1) {
    return clauses[0]!;
  }
  return or(...clauses)!;
}
