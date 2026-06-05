"use client";

import { useCallback, useEffect, useRef } from "react";

type OtpCredential = Credential & { code?: string };

function isWebOtpSupported(): boolean {
  return typeof window !== "undefined" && "OTPCredential" in window;
}

/**
 * Chrome/Android Web OTP: fills from SMS when the message ends with `@host #code`.
 * No-op on browsers without OTPCredential (e.g. iOS uses autocomplete=one-time-code).
 */
export function useWebOtpAutofill(params: {
  enabled: boolean;
  onCode: (raw: string) => void;
}): { requestFromSms: () => void } {
  const onCodeRef = useRef(params.onCode);

  onCodeRef.current = params.onCode;
  const abortRef = useRef<AbortController | null>(null);

  const requestFromSms = useCallback(() => {
    if (!params.enabled || !isWebOtpSupported()) {
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();

    abortRef.current = ac;

    void navigator.credentials
      .get({
        otp: { transport: ["sms"] },
        signal: ac.signal,
      } as CredentialRequestOptions)
      .then((cred) => {
        if (!cred || !("code" in cred)) {
          return;
        }
        const code = (cred as OtpCredential).code?.trim();

        if (code) {
          onCodeRef.current(code);
        }
      })
      .catch(() => {
        // No matching SMS, permission denied, or aborted
      });
  }, [params.enabled]);

  useEffect(() => {
    if (!params.enabled) {
      return;
    }
    requestFromSms();

    return () => {
      abortRef.current?.abort();
    };
  }, [params.enabled, requestFromSms]);

  return { requestFromSms };
}
