import { useCallback, useRef, useState } from "react";

import {
  pulseAccepted,
  pulseDuplicate,
  pulseRejected,
  pulseScan,
} from "@/lib/scan-feedback";

export type ScanFeedbackState =
  | "idle"
  | "decoded"
  | "submitting"
  | "accepted"
  | "rejected"
  | "duplicate";

const ACCEPT_COOLDOWN_MS = 3000;
/** Reject, invalid, and duplicate share one cooldown so overlay + scanner stay locked together. */
const RESULT_COOLDOWN_MS = 2500;

const COOLDOWN_STATES: ScanFeedbackState[] = [
  "decoded",
  "submitting",
  "accepted",
  "rejected",
  "duplicate",
];

export function isScannerLockedState(state: ScanFeedbackState): boolean {
  return COOLDOWN_STATES.includes(state);
}

export function useScanFeedback() {
  const [state, setState] = useState<ScanFeedbackState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [coolingDown, setCoolingDown] = useState(false);
  const lastTokenRef = useRef("");
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCooldownTimer = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  const startCooldown = useCallback(
    (ms: number, next: ScanFeedbackState) => {
      clearCooldownTimer();
      setCoolingDown(true);

      cooldownTimerRef.current = setTimeout(() => {
        setState(next);
        setMessage(null);
        setCoolingDown(false);
        cooldownTimerRef.current = null;
      }, ms);
    },
    [clearCooldownTimer],
  );

  const onDecoded = useCallback(
    (token: string) => {
      if (coolingDown) {
        if (token === lastTokenRef.current) {
          setState("duplicate");
          setMessage(null);
          startCooldown(RESULT_COOLDOWN_MS, "idle");

          return false;
        }

        return false;
      }

      if (token === lastTokenRef.current) {
        setState("duplicate");
        setMessage(null);
        pulseDuplicate();
        startCooldown(RESULT_COOLDOWN_MS, "idle");

        return false;
      }

      lastTokenRef.current = token;
      setState("decoded");

      return true;
    },
    [coolingDown, startCooldown],
  );

  const onScanned = useCallback(() => {
    if (coolingDown) {
      return;
    }

    pulseScan();
  }, [coolingDown]);

  const onInvalidAdmission = useCallback(
    (rawText: string) => {
      if (coolingDown) {
        return;
      }

      const fingerprint = rawText.trim().slice(0, 128) || "__empty__";

      lastTokenRef.current = `invalid:${fingerprint}`;
      setState("rejected");
      setMessage("Invalid admission code!");
      pulseRejected();
      startCooldown(RESULT_COOLDOWN_MS, "idle");
    },
    [coolingDown, startCooldown],
  );

  const onSubmitting = useCallback(() => {
    setState("submitting");
  }, []);

  const onAccepted = useCallback(
    (subtitle?: string) => {
      setState("accepted");
      setMessage(subtitle ?? null);
      pulseAccepted();
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
      pulseRejected();
      startCooldown(RESULT_COOLDOWN_MS, "idle");

      return false;
    },
    [startCooldown],
  );

  const onDuplicate = useCallback(() => {
    setState("duplicate");
    setMessage(null);
    pulseDuplicate();
    startCooldown(RESULT_COOLDOWN_MS, "idle");
  }, [startCooldown]);

  const reset = useCallback(() => {
    clearCooldownTimer();
    setState("idle");
    setMessage(null);
    setCoolingDown(false);
    lastTokenRef.current = "";
  }, [clearCooldownTimer]);

  return {
    state,
    message,
    coolingDown,
    onScanned,
    onDecoded,
    onInvalidAdmission,
    onSubmitting,
    onAccepted,
    onRejected,
    onDuplicate,
    reset,
  };
}
