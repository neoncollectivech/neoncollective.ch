import { useCallback, useRef, useState } from "react";

export type ScanFeedbackState =
  | "idle"
  | "decoded"
  | "submitting"
  | "accepted"
  | "rejected"
  | "duplicate";

const ACCEPT_COOLDOWN_MS = 1500;
const REJECT_COOLDOWN_MS = 800;
const INVALID_COOLDOWN_MS = 700;
/** Short pulse when the reader detects any QR payload. */
const SCAN_VIBRATE_MS = 25;

function vibrate(pattern: number | number[]) {
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

export function useScanFeedback() {
  const [state, setState] = useState<ScanFeedbackState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const lastTokenRef = useRef("");
  const cooldownUntilRef = useRef(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCoolingDown = useCallback(() => {
    return Date.now() < cooldownUntilRef.current;
  }, []);

  const startCooldown = useCallback((ms: number, next: ScanFeedbackState) => {
    cooldownUntilRef.current = Date.now() + ms;

    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }

    cooldownTimerRef.current = setTimeout(() => {
      setState(next);
      setMessage(null);
      cooldownTimerRef.current = null;
    }, ms);
  }, []);

  const onDecoded = useCallback(
    (token: string) => {
      if (isCoolingDown()) {
        if (token === lastTokenRef.current) {
          setState("duplicate");

          return false;
        }

        return false;
      }

      if (token === lastTokenRef.current) {
        setState("duplicate");
        vibrate(20);

        return false;
      }

      lastTokenRef.current = token;
      setState("decoded");

      return true;
    },
    [isCoolingDown],
  );

  const onScanned = useCallback(() => {
    vibrate(SCAN_VIBRATE_MS);
  }, []);

  const onInvalidAdmission = useCallback(() => {
    if (isCoolingDown()) {
      return;
    }

    setState("rejected");
    setMessage("Invalid admission code!");
    startCooldown(INVALID_COOLDOWN_MS, "idle");
  }, [isCoolingDown, startCooldown]);

  const onSubmitting = useCallback(() => {
    setState("submitting");
  }, []);

  const onAccepted = useCallback(
    (subtitle?: string) => {
      setState("accepted");
      setMessage(subtitle ?? null);
      vibrate(40);
      startCooldown(ACCEPT_COOLDOWN_MS, "idle");
      lastTokenRef.current = "";

      return true;
    },
    [startCooldown],
  );

  const onRejected = useCallback(
    (errorMessage: string) => {
      setState("rejected");
      setMessage(errorMessage);
      vibrate([30, 30, 30]);
      startCooldown(REJECT_COOLDOWN_MS, "idle");

      return false;
    },
    [startCooldown],
  );

  const reset = useCallback(() => {
    setState("idle");
    setMessage(null);
    lastTokenRef.current = "";
    cooldownUntilRef.current = 0;

    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  return {
    state,
    message,
    isCoolingDown,
    onScanned,
    onDecoded,
    onInvalidAdmission,
    onSubmitting,
    onAccepted,
    onRejected,
    reset,
  };
}
