import { AxiosError } from "axios";

/** User-facing message from a failed events/stripe API call. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    if (!error.response) {
      return "Could not reach the server. Is the events API running on port 8082?";
    }
    const data = error.response.data;

    if (data && typeof data === "object" && "error" in data) {
      const msg = (data as { error?: unknown }).error;

      if (typeof msg === "string" && msg.trim().length > 0) {
        return msg.trim();
      }
    }
  }

  return fallback;
}
