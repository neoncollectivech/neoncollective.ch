import axios from "axios";

/** Global API keys must pick an event before JWKS can load. */
export function isJwksEventRequiredError(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 400) {
    return false;
  }

  const data = error.response.data;

  if (data && typeof data === "object" && "error" in data) {
    const message = (data as { error: unknown }).error;

    if (
      typeof message === "string" &&
      message.toLowerCase().includes("eventid")
    ) {
      return true;
    }
  }

  return false;
}
