/**
 * Scan haptics: navigator.vibrate often fails on Android Chrome when called from
 * async worker/decode paths (no user activation). Unlock AudioContext on first
 * touch, then use vibrate + short audio ticks as fallback.
 */

let audioContext: AudioContext | null = null;
let unlocked = false;

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
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

/** Call from a user gesture (touch/click) once so later scan feedback can play audio. */
export function unlockScanHaptics(): void {
  const ctx = getAudioContext();

  if (!ctx) {
    return;
  }

  unlocked = true;

  if (ctx.state === "suspended") {
    void ctx.resume();
  }

  // Prime vibration in the same user activation (helps some Android builds).
  tryVibrate(1);
}

function tryVibrate(pattern: number | number[]): boolean {
  if (typeof navigator.vibrate !== "function") {
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
  const duration = kind === "success" ? 0.06 : kind === "error" ? 0.08 : 0.035;
  const peak = kind === "success" ? 0.12 : kind === "error" ? 0.1 : 0.07;

  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = peak;

  osc.connect(gain);
  gain.connect(ctx.destination);

  const start = ctx.currentTime;

  gain.gain.setValueAtTime(peak, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  osc.start(start);
  osc.stop(start + duration + 0.01);
}

function pulse(
  pattern: number | number[],
  tick: "scan" | "success" | "error",
): void {
  const vibrated = tryVibrate(pattern);
  const useAudioFallback = !vibrated || isAndroid();

  if (useAudioFallback && unlocked) {
    playTick(tick);
  }
}

/** Any QR decoded. */
export function pulseScan(): void {
  pulse(25, "scan");
}

/** Valid admission accepted. */
export function pulseAccepted(): void {
  pulse([20, 40, 20], "success");
}

/** Invalid code or API rejection. */
export function pulseRejected(): void {
  pulse([30, 40, 30], "error");
}

/** Duplicate scan hint. */
export function pulseDuplicate(): void {
  pulse(15, "scan");
}
