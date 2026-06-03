/**
 * Scan haptics for mobile browsers.
 *
 * Chrome Android requires **sticky user activation**: `navigator.vibrate()` from
 * the QR worker/async path usually returns true but does nothing. We queue
 * feedback and flush it on the next touch/pointer event, and play audio after
 * an explicit unlock gesture.
 */

const STORAGE_KEY = "neon:door:hapticsEnabled";
const VIBRATION_PREF_KEY = "neon:door:feedbackVibration";
const SOUND_PREF_KEY = "neon:door:feedbackSound";

let audioContext: AudioContext | null = null;
let unlocked = false;

type PendingPulse = "scan" | "success" | "error" | "duplicate" | null;

export type FeedbackKind = Exclude<PendingPulse, null>;

let pending: PendingPulse = null;

/** Longer pulses — many Android devices barely feel sub-100ms vibrations. */
const PATTERNS = {
  scan: [100, 60, 140] as const,
  duplicate: [80, 40, 80] as const,
  success: [80, 50, 120, 50, 120] as const,
  error: [100, 70, 100, 70, 140] as const,
};

const TEST_PATTERN = [80, 50, 120, 50, 120] as const;

export type FeedbackPreferences = {
  vibration: boolean;
  sound: boolean;
};

export type HapticDiagnostics = {
  vibrationApiPresent: boolean;
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  unlocked: boolean;
  audioContextState: string | null;
};

function readBool(key: string, defaultValue: boolean): boolean {
  const raw = sessionStorage.getItem(key);

  if (raw === null) {
    return defaultValue;
  }

  return raw === "1";
}

function writeBool(key: string, value: boolean): void {
  sessionStorage.setItem(key, value ? "1" : "0");
}

export function getFeedbackPreferences(): FeedbackPreferences {
  return {
    vibration: readBool(VIBRATION_PREF_KEY, true),
    sound: readBool(SOUND_PREF_KEY, true),
  };
}

export function setFeedbackPreferences(
  patch: Partial<FeedbackPreferences>,
): FeedbackPreferences {
  if (patch.vibration !== undefined) {
    writeBool(VIBRATION_PREF_KEY, patch.vibration);
  }

  if (patch.sound !== undefined) {
    writeBool(SOUND_PREF_KEY, patch.sound);
  }

  return getFeedbackPreferences();
}

export function isVibrationApiPresent(): boolean {
  return typeof navigator.vibrate === "function";
}

export function areScanHapticsUnlocked(): boolean {
  return unlocked || sessionStorage.getItem(STORAGE_KEY) === "1";
}

export function getHapticDiagnostics(): HapticDiagnostics {
  const prefs = getFeedbackPreferences();
  const ctx = getAudioContext();

  return {
    vibrationApiPresent: isVibrationApiPresent(),
    vibrationEnabled: prefs.vibration,
    soundEnabled: prefs.sound,
    unlocked: areScanHapticsUnlocked(),
    audioContextState: ctx?.state ?? null,
  };
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
  if (!isVibrationApiPresent() || !getFeedbackPreferences().vibration) {
    return false;
  }

  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

function playTick(kind: "scan" | "success" | "error"): void {
  if (!getFeedbackPreferences().sound) {
    return;
  }

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

function patternFor(kind: FeedbackKind): number | number[] {
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

function tickFor(kind: FeedbackKind): "scan" | "success" | "error" {
  if (kind === "success") {
    return "success";
  }

  if (kind === "error") {
    return "error";
  }

  return "scan";
}

function fire(kind: FeedbackKind, fromUserGesture: boolean): void {
  const pattern = patternFor(kind);

  if (fromUserGesture) {
    tryVibrate(pattern);

    if (unlocked) {
      playTick(tickFor(kind));
    }

    return;
  }

  tryVibrate(pattern);

  if (unlocked) {
    playTick(tickFor(kind));
  }
}

function queue(kind: FeedbackKind): void {
  pending = kind;
  fire(kind, false);
}

export function flushScanHapticsFromUserGesture(): void {
  unlockScanHaptics();

  if (!pending) {
    return;
  }

  const kind = pending;

  pending = null;
  fire(kind, true);
}

export function unlockScanHaptics(): void {
  const ctx = getAudioContext();

  unlocked = true;
  sessionStorage.setItem(STORAGE_KEY, "1");

  if (ctx?.state === "suspended") {
    void ctx.resume();
  }
}

export function resetScanHapticsPermission(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  unlocked = false;
  pending = null;
}

/**
 * Enable vibration + sound and run unlock test inside a user gesture.
 */
export function enableAllFeedbackInUserGesture(): {
  vibrated: boolean;
  preferences: FeedbackPreferences;
} {
  setFeedbackPreferences({ vibration: true, sound: true });

  return {
    vibrated: unlockAndTestScanHaptics(),
    preferences: getFeedbackPreferences(),
  };
}

export function unlockAndTestScanHaptics(): boolean {
  unlockScanHaptics();
  pending = null;

  return tryVibrate([...TEST_PATTERN]);
}

/** Test a specific scan feedback pattern (must run inside click/touch handler). */
export function testFeedbackInUserGesture(kind: FeedbackKind): {
  vibrated: boolean;
} {
  unlockScanHaptics();
  pending = null;
  fire(kind, true);

  return {
    vibrated: isVibrationApiPresent() && getFeedbackPreferences().vibration,
  };
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
