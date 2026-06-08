import { peopleService } from "../../services/people.service";

export const POS_PEOPLE_SEARCH_MIN_LENGTH = 2;
export const POS_PEOPLE_SEARCH_LIMIT = 25;

export type PosPersonSearchRow = {
  id: string;
  givenName: string;
  familyName: string;
  email: string | null;
  phone: string | null;
};

export async function searchPosPeople(query: string): Promise<PosPersonSearchRow[]> {
  const q = query.trim();
  if (q.length < POS_PEOPLE_SEARCH_MIN_LENGTH) {
    return [];
  }

  const result = await peopleService.list({
    q,
    limit: POS_PEOPLE_SEARCH_LIMIT,
    skip: 0,
    sort: "givenName",
    filters: {},
  });

  return result.items.map((row) => ({
    id: String(row.id),
    givenName: String(row.givenName),
    familyName: String(row.familyName),
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
  }));
}
