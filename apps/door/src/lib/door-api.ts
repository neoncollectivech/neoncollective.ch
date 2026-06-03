import { api } from "@/lib/api-client";

export async function postCheckIn(credential: string): Promise<{ ok: true }> {
  const { data } = await api.post<{ ok: true }>("/check-in", { credential });

  return data;
}
