import { Flashlight } from "lucide-react";

import { Button } from "@/components/ui/button";

type TorchToggleProps = {
  torchSupported: boolean;
  torchOn: boolean;
  onToggleTorch: () => void;
};

export function TorchToggle({
  torchSupported,
  torchOn,
  onToggleTorch,
}: TorchToggleProps) {
  if (!torchSupported) {
    return null;
  }

  return (
    <Button
      aria-label={torchOn ? "Turn off flashlight" : "Turn on flashlight"}
      size="icon"
      type="button"
      variant={torchOn ? "default" : "outline"}
      onClick={() => void onToggleTorch()}
    >
      <Flashlight className="h-5 w-5" />
    </Button>
  );
}
