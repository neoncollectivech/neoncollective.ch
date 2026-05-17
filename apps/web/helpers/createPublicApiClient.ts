import axios, { type AxiosInstance } from "axios";

/** When to log a missing `NEXT_PUBLIC_*` URL at module load. */
export type WarnMissingMode = "server" | "always" | "never";

/**
 * Shared axios instance for calling Cloud Functions from the static site.
 * Base URL comes from `NEXT_PUBLIC_*` env; optional credentialed requests for cookie APIs.
 */
export function createPublicApiClient(params: {
  envUrl: string | undefined;
  envLabel: string;
  warnMissing: WarnMissingMode;
  withCredentials?: boolean;
}): AxiosInstance {
  const hasUrl = Boolean(params.envUrl?.trim());

  if (!hasUrl) {
    const shouldWarn =
      params.warnMissing === "always" ||
      (params.warnMissing === "server" && typeof window === "undefined");

    if (shouldWarn) {
      // eslint-disable-next-line no-console
      console.warn(`${params.envLabel} is not set.`);
    }
  }

  return axios.create({
    baseURL: params.envUrl?.trim() ?? "",
    headers: { "Content-Type": "application/json" },
    ...(params.withCredentials ? { withCredentials: true } : {}),
  });
}
