"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import { exchangeRegistrationSessionCode } from "@/helpers/eventsApi";

/**
 * Exchanges `?code=` from the sign-in link (GET on the static site), then strips it from the URL.
 * Call from any page that can receive the participant access link.
 */
export function useExchangeRegistrationSessionCode(params: {
  code: string | undefined;
  queryKeysToInvalidate: QueryKey[];
  sessionErrorLabel: string;
}): { codeHandled: boolean; codeError: string | null } {
  const queryClient = useQueryClient();
  const [codeHandled, setCodeHandled] = useState(!params.code);
  const [codeError, setCodeError] = useState<string | null>(null);
  const keysRef = useRef(params.queryKeysToInvalidate);

  keysRef.current = params.queryKeysToInvalidate;

  useEffect(() => {
    if (!params.code || codeHandled) {
      return;
    }
    let cancelled = false;

    (async () => {
      const rawCode = params.code;

      if (!rawCode) {
        return;
      }
      try {
        await exchangeRegistrationSessionCode(rawCode);
        if (!cancelled) {
          setCodeHandled(true);
          const url = new URL(window.location.href);

          url.searchParams.delete("code");
          window.history.replaceState({}, "", url.toString());
          for (const key of keysRef.current) {
            await queryClient.invalidateQueries({ queryKey: key });
          }
        }
      } catch {
        if (!cancelled) {
          setCodeError(params.sessionErrorLabel);
          setCodeHandled(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.code, params.sessionErrorLabel, codeHandled, queryClient]);

  return { codeHandled, codeError };
}
