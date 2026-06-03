import { api } from "@/lib/api-client";

export async function postCheckIn(token: string): Promise<{ ok: true }> {
  const { data } = await api.post<{ ok: true }>("/check-in", { token });

  return data;
}
