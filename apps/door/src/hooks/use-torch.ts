import { useCallback, useEffect, useState } from "react";

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

type TorchCapableTrack = MediaStreamTrack & {
  getCapabilities?: () => TorchCapabilities;
};

export function useTorch(videoTrack: MediaStreamTrack | null) {
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [brightScreen, setBrightScreen] = useState(false);

  useEffect(() => {
    if (!videoTrack) {
      setTorchSupported(false);
      setTorchOn(false);

      return;
    }

    const track = videoTrack as TorchCapableTrack;
    const caps = track.getCapabilities?.() as TorchCapabilities | undefined;

    setTorchSupported(Boolean(caps && "torch" in caps && caps.torch));
  }, [videoTrack]);

  const toggleTorch = useCallback(async () => {
    if (!videoTrack || !torchSupported) {
      return;
    }

    const track = videoTrack as TorchCapableTrack;
    const next = !torchOn;

    try {
      await track.applyConstraints({
        advanced: [{ torch: next }] as unknown as MediaTrackConstraintSet[],
      });
      setTorchOn(next);
    } catch {
      setTorchOn(false);
    }
  }, [videoTrack, torchSupported, torchOn]);

  const toggleBrightScreen = useCallback(() => {
    setBrightScreen((v) => !v);
  }, []);

  return {
    torchSupported,
    torchOn,
    brightScreen,
    toggleTorch,
    toggleBrightScreen,
  };
}
