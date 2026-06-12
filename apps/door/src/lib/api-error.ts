import axios from "axios";

function readApiErrorBody(data: unknown): string | null {
  if (data && typeof data === "object" && "error" in data) {
    const msg = (data as { error: unknown }).error;

    if (typeof msg === "string" && msg.trim()) {
      return msg;
    }
  }
  if (typeof data === "string" && data.trim()) {
    return data;
  }

  return null;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Request failed",
): string {
  if (axios.isAxiosError(error)) {
    const bodyMessage = readApiErrorBody(error.response?.data);

    if (bodyMessage) {
      return bodyMessage;
    }

    const status = error.response?.status;

    if (status === 401) {
      return "Invalid or missing API key.";
    }
    if (status === 404) {
      return "Not found.";
    }
    if (status === 409) {
      return "This action conflicted with current state. Try again.";
    }
    if (status === 502) {
      return "The server could not reach SumUp. Try again in a moment.";
    }
    if (status === 503) {
      return "Service temporarily unavailable. Try again in a moment.";
    }

    if (!error.response && error.request) {
      return "Could not reach the API. Check your connection and try again.";
    }
  }
  if (error instanceof Error && error.message && error.message !== "Network Error") {
    return error.message;
  }

  return fallback;
}
