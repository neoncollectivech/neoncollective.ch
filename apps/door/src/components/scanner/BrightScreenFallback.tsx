import { Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

type BrightScreenFallbackProps = {
  active: boolean;
  onToggle: () => void;
};

export function BrightScreenFallback({
  active,
  onToggle,
}: BrightScreenFallbackProps) {
  return (
    <Button
      aria-label={active ? "Disable bright screen" : "Enable bright screen"}
      size="sm"
      type="button"
      variant={active ? "default" : "outline"}
      onClick={onToggle}
    >
      <Sun className="h-4 w-4" />
      Bright screen
    </Button>
  );
}
