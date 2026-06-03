/** Best-effort continuous autofocus and higher resolution on field devices. */
export async function applyCameraEnhancements(
  track: MediaStreamTrack,
): Promise<void> {
  const capabilities = track.getCapabilities?.() as
    | (MediaTrackCapabilities & {
        focusMode?: string[];
      })
    | undefined;

  const advanced: MediaTrackConstraintSet[] = [];

  if (capabilities?.focusMode?.includes("continuous")) {
    advanced.push({ focusMode: "continuous" } as MediaTrackConstraintSet);
  }

  if (advanced.length === 0) {
    return;
  }

  try {
    await track.applyConstraints({ advanced });
  } catch {
    // Unsupported on some browsers — non-fatal.
  }
}
