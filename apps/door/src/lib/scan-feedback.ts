/**
 * Scan feedback (sound) for door check-in.
 *
 * Mobile browsers require user activation for AudioContext; unlock state and
 * sound preference persist in localStorage across PWA restarts.
 */

import {
  readPersistedItem,
  removePersistedItem,
  writePersistedItem,
} from "@/lib/storage/persisted-storage";

const STORAGE_KEY = "neon:door:feedbackUnlocked";
const SOUND_PREF_KEY = "neon:door:feedbackSound";

let audioContext: AudioContext | null = null;
let unlocked = false;

export type FeedbackKind = "scan" | "success" | "error" | "duplicate";

export type FeedbackPreferences = {
  sound: boolean;
};

export type FeedbackDiagnostics = {
  soundEnabled: boolean;
  unlocked: boolean;
  audioContextState: string | null;
};

function readBool(key: string, defaultValue: boolean): boolean {
  const raw = readPersistedItem(key);

  if (raw === null) {
    return defaultValue;
  }

  return raw === "1";
}

function writeBool(key: string, value: boolean): void {
  writePersistedItem(key, value ? "1" : "0");
}

export function getFeedbackPreferences(): FeedbackPreferences {
  return {
    sound: readBool(SOUND_PREF_KEY, true),
  };
}

export function setFeedbackPreferences(
  patch: Partial<FeedbackPreferences>,
): FeedbackPreferences {
  if (patch.sound !== undefined) {
    writeBool(SOUND_PREF_KEY, patch.sound);
  }

  return getFeedbackPreferences();
}

export function isScanFeedbackUnlocked(): boolean {
  return unlocked || readPersistedItem(STORAGE_KEY) === "1";
}

export function getFeedbackDiagnostics(): FeedbackDiagnostics {
  const prefs = getFeedbackPreferences();
  const ctx = getAudioContext();

  return {
    soundEnabled: prefs.sound,
    unlocked: isScanFeedbackUnlocked(),
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

function tickFor(kind: FeedbackKind): "scan" | "success" | "error" {
  if (kind === "success") {
    return "success";
  }

  if (kind === "error") {
    return "error";
  }

  return "scan";
}

function fire(kind: FeedbackKind): void {
  if (!unlocked) {
    return;
  }

  playTick(tickFor(kind));
}

export function unlockScanFeedback(): void {
  const ctx = getAudioContext();

  unlocked = true;
  writePersistedItem(STORAGE_KEY, "1");

  if (ctx?.state === "suspended") {
    void ctx.resume();
  }
}

export function resetScanFeedbackPermission(): void {
  removePersistedItem(STORAGE_KEY);
  unlocked = false;
}

export function enableSoundFeedbackInUserGesture(): {
  played: boolean;
  preferences: FeedbackPreferences;
} {
  setFeedbackPreferences({ sound: true });
  unlockScanFeedback();
  fire("success");

  return {
    played: isScanFeedbackUnlocked() && getFeedbackPreferences().sound,
    preferences: getFeedbackPreferences(),
  };
}

export function testFeedbackInUserGesture(kind: FeedbackKind): void {
  unlockScanFeedback();
  fire(kind);
}

export function pulseScan(): void {
  fire("scan");
}

export function pulseAccepted(): void {
  fire("success");
}

export function pulseRejected(): void {
  fire("error");
}

export function pulseDuplicate(): void {
  fire("duplicate");
}
