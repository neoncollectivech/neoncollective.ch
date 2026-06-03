import { api } from "@/lib/api-client";

export type DoorEventCatalogRow = {
  id?: string;
  slug: string;
  title: string;
  summary: string | null;
  location: string | null;
  startsAt: string | null;
  inviteOnly: boolean;
};

export async function postCheckIn(credential: string): Promise<{ ok: true }> {
  const { data } = await api.post<{ ok: true }>("/check-in", { credential });

  return data;
}

export async function listDoorEvents(
  apiKey: string,
): Promise<Array<DoorEventCatalogRow & { id: string }>> {
  const { data } = await api.get<{ events: DoorEventCatalogRow[] }>("/events", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const withIds = data.events.flatMap((row) =>
    row.id ? [{ ...row, id: row.id }] : [],
  );

  if (data.events.length > 0 && withIds.length === 0) {
    throw new Error(
      "Event catalog did not include event IDs. Update events-api and try again.",
    );
  }

  return withIds;
}
