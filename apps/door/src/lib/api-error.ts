import axios from "axios";

export function getApiErrorMessage(
  error: unknown,
  fallback = "Request failed",
): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;

    if (data && typeof data === "object" && "error" in data) {
      const msg = (data as { error: unknown }).error;

      if (typeof msg === "string" && msg.trim()) {
        return msg;
      }
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
