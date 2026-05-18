import { AxiosError } from "axios";

export class RegistrationPendingError extends Error {
  constructor() {
    super("REGISTRATION_PENDING");
    this.name = "RegistrationPendingError";
  }
}

export function isRegistrationPendingError(err: unknown): boolean {
  return err instanceof RegistrationPendingError;
}

export function isRetryableCheckoutConfirmError(err: unknown): boolean {
  if (!(err instanceof AxiosError)) {
    return true;
  }
  const status = err.response?.status;
  if (status == null) {
    return true;
  }
  if (status >= 500) {
    return true;
  }
  if (status !== 409) {
    return false;
  }
  const message =
    typeof err.response?.data === "object" &&
    err.response.data &&
    "error" in err.response.data &&
    typeof (err.response.data as { error?: string }).error === "string"
      ? (err.response.data as { error: string }).error
      : "";
  return message.includes("not complete yet");
}

export const checkoutConfirmRetryDelay = (attemptIndex: number): number =>
  Math.min(400 * 1.6 ** attemptIndex, 8_000);

export function checkoutConfirmErrorMessage(
  err: unknown,
  labels: { timeout: string; generic: string },
): string {
  if (isRegistrationPendingError(err)) {
    return labels.timeout;
  }
  if (err instanceof AxiosError) {
    const apiError =
      typeof err.response?.data === "object" &&
      err.response.data &&
      "error" in err.response.data &&
      typeof (err.response.data as { error?: string }).error === "string"
        ? (err.response.data as { error: string }).error
        : null;
    if (apiError) {
      return apiError;
    }
  }
  return labels.generic;
}
