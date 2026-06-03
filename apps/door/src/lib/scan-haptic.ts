/**
 * Scan haptics for mobile browsers (incl. Pixel / Chrome Android).
 *
 * Chrome requires user activation for `navigator.vibrate()`. Decode is async, so
 * we also vibrate when a finger is still on screen or `navigator.userActivation`
 * is active, and queue + flush on the next touch otherwise.
 */

const STORAGE_KEY = "neon:door:hapticsEnabled";
const VIBRATION_PREF_KEY = "neon:door:feedbackVibration";
const SOUND_PREF_KEY = "neon:door:feedbackSound";

let audioContext: AudioContext | null = null;
let unlocked = false;
let touchTrackingInstalled = false;
let activeTouches = 0;
let lastVibrateAccepted: boolean | null = null;

type PendingPulse = "scan" | "success" | "error" | "duplicate" | null;

export type FeedbackKind = Exclude<PendingPulse, null>;

let pending: PendingPulse = null;

/** Pixel-class devices often ignore sub-150ms pulses. */
const PATTERNS = {
  scan: [180, 80, 180] as const,
  duplicate: [120, 60, 120] as const,
  success: [120, 60, 180, 60, 180] as const,
  error: [150, 80, 150, 80, 200] as const,
};

const TEST_PATTERN = [150, 80, 200, 80, 200] as const;
const RAW_MOTOR_MS = 500;

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
  activeTouches: number;
  userActivationActive: boolean;
  lastVibrateAccepted: boolean | null;
};

export function initScanHapticTouchTracking(): void {
  if (touchTrackingInstalled || typeof document === "undefined") {
    return;
  }

  touchTrackingInstalled = true;

  const onStart = () => {
    activeTouches += 1;
  };

  const onEnd = () => {
    activeTouches = Math.max(0, activeTouches - 1);
  };

  document.addEventListener("touchstart", onStart, {
    passive: true,
    capture: true,
  });
  document.addEventListener("touchend", onEnd, {
    passive: true,
    capture: true,
  });
  document.addEventListener("touchcancel", onEnd, {
    passive: true,
    capture: true,
  });
}

function isUserActivationActive(): boolean {
  const nav = navigator as Navigator & {
    userActivation?: { isActive: boolean };
  };

  return nav.userActivation?.isActive === true;
}

function isInUserGestureContext(): boolean {
  return activeTouches > 0 || isUserActivationActive();
}

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
    activeTouches,
    userActivationActive: isUserActivationActive(),
    lastVibrateAccepted,
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

function invokeVibrate(
  pattern: number | number[],
  respectPrefs = true,
): boolean {
  if (!isVibrationApiPresent()) {
    lastVibrateAccepted = false;

    return false;
  }

  if (respectPrefs && !getFeedbackPreferences().vibration) {
    lastVibrateAccepted = false;

    return false;
  }

  try {
    navigator.vibrate(0);
    const accepted = navigator.vibrate(pattern);

    lastVibrateAccepted = accepted;

    return accepted;
  } catch {
    lastVibrateAccepted = false;

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

function fire(kind: FeedbackKind, inGesture: boolean): void {
  if (inGesture) {
    invokeVibrate(patternFor(kind));

    if (unlocked) {
      playTick(tickFor(kind));
    }

    return;
  }

  invokeVibrate(patternFor(kind));

  if (unlocked) {
    playTick(tickFor(kind));
  }
}

function queue(kind: FeedbackKind): void {
  pending = kind;

  if (isInUserGestureContext()) {
    pending = null;
    fire(kind, true);

    return;
  }

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
  lastVibrateAccepted = null;
}

/**
 * Direct motor test — call synchronously from pointerdown/click only.
 * Ignores vibration pref so you can verify the hardware path.
 */
export function rawMotorTestInUserGesture(): {
  apiPresent: boolean;
  accepted: boolean;
} {
  unlockScanHaptics();
  pending = null;

  if (!isVibrationApiPresent()) {
    return { apiPresent: false, accepted: false };
  }

  const accepted = invokeVibrate(RAW_MOTOR_MS, false);

  return { apiPresent: true, accepted };
}

export function enableAllFeedbackInUserGesture(): {
  vibrated: boolean;
  preferences: FeedbackPreferences;
} {
  setFeedbackPreferences({ vibration: true, sound: true });
  unlockScanHaptics();
  pending = null;

  const vibrated = invokeVibrate([...TEST_PATTERN]);

  if (unlocked) {
    playTick("success");
  }

  return {
    vibrated,
    preferences: getFeedbackPreferences(),
  };
}

export function unlockAndTestScanHaptics(): boolean {
  unlockScanHaptics();
  pending = null;

  return invokeVibrate([...TEST_PATTERN]);
}

export function testFeedbackInUserGesture(kind: FeedbackKind): {
  vibrated: boolean;
} {
  unlockScanHaptics();
  pending = null;
  fire(kind, true);

  return { vibrated: lastVibrateAccepted === true };
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

// Auto-init when loaded in browser.
initScanHapticTouchTracking();
