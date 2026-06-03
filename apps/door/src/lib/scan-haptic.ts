/**
 * Scan haptics for mobile browsers.
 *
 * Chrome Android requires **sticky user activation**: `navigator.vibrate()` from
 * the QR worker/async path usually returns true but does nothing. We queue
 * feedback and flush it on the next touch/pointer event, and play audio after
 * an explicit unlock gesture.
 *
 * There is no permission prompt for vibration on the web — only system settings
 * (DND / silent) and Permissions-Policy can block it.
 */

const STORAGE_KEY = "neon:door:hapticsEnabled";

let audioContext: AudioContext | null = null;
let unlocked = false;

type PendingPulse = "scan" | "success" | "error" | "duplicate" | null;

let pending: PendingPulse = null;

/** Longer pulses — many Android devices barely feel sub-100ms vibrations. */
const PATTERNS = {
  scan: [100, 60, 140] as const,
  duplicate: [80, 40, 80] as const,
  success: [80, 50, 120, 50, 120] as const,
  error: [100, 70, 100, 70, 140] as const,
};

const TEST_PATTERN = [80, 50, 120, 50, 120] as const;

export function isVibrationApiPresent(): boolean {
  return typeof navigator.vibrate === "function";
}

export function areScanHapticsUnlocked(): boolean {
  return unlocked || sessionStorage.getItem(STORAGE_KEY) === "1";
}

function getAudioContext(): AudioContext | null {
  if (typeof AudioContext === "undefined") {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContext();
  }

  return audioContext;
}

function tryVibrate(pattern: number | number[]): boolean {
  if (!isVibrationApiPresent()) {
    return false;
  }

  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

function playTick(kind: "scan" | "success" | "error"): void {
  const ctx = getAudioContext();

  if (!ctx || ctx.state !== "running") {
    return;
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  const freq = kind === "success" ? 880 : kind === "error" ? 220 : 1200;
  const duration = kind === "success" ? 0.09 : kind === "error" ? 0.12 : 0.06;
  const peak = kind === "success" ? 0.18 : kind === "error" ? 0.14 : 0.12;

  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);

  const start = ctx.currentTime;

  gain.gain.setValueAtTime(peak, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  osc.start(start);
  osc.stop(start + duration + 0.01);
}

function patternFor(kind: Exclude<PendingPulse, null>): number | number[] {
  if (kind === "success") {
    return [...PATTERNS.success];
  }

  if (kind === "error") {
    return [...PATTERNS.error];
  }

  if (kind === "duplicate") {
    return [...PATTERNS.duplicate];
  }

  return [...PATTERNS.scan];
}

function fire(
  kind: Exclude<PendingPulse, null>,
  fromUserGesture: boolean,
): void {
  const pattern = patternFor(kind);

  if (fromUserGesture) {
    tryVibrate(pattern);
    if (unlocked) {
      playTick(kind === "duplicate" ? "scan" : kind);
    }

    return;
  }

  tryVibrate(pattern);

  if (unlocked) {
    playTick(kind === "duplicate" ? "scan" : kind);
  }
}

function queue(kind: Exclude<PendingPulse, null>): void {
  pending = kind;
  fire(kind, false);
}

/**
 * Call from touch/click handlers (user gesture). Flushes queued scan feedback
 * and resumes audio — required for reliable vibration on Android Chrome.
 */
export function flushScanHapticsFromUserGesture(): void {
  unlockScanHaptics();

  if (!pending) {
    return;
  }

  const kind = pending;

  pending = null;
  fire(kind, true);
}

/** Resume audio; call from any user gesture once per session. */
export function unlockScanHaptics(): void {
  const ctx = getAudioContext();

  unlocked = true;
  sessionStorage.setItem(STORAGE_KEY, "1");

  if (ctx?.state === "suspended") {
    void ctx.resume();
  }
}

/**
 * User taps "Enable haptics" — runs test vibration inside the gesture.
 * Returns whether the API accepted the request (not whether the motor ran).
 */
export function unlockAndTestScanHaptics(): boolean {
  unlockScanHaptics();

  pending = null;

  return tryVibrate([...TEST_PATTERN]);
}

export function pulseScan(): void {
  queue("scan");
}

export function pulseAccepted(): void {
  queue("success");
}

export function pulseRejected(): void {
  queue("error");
}

export function pulseDuplicate(): void {
  queue("duplicate");
}
