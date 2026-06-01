import type { EventImageRow } from "@/lib/admin-api";

import clsx from "clsx";

import { Button } from "@/components/ui/button";

type EventImageFocalPreviewProps = {
  image: EventImageRow;
  disabled?: boolean;
  isHero?: boolean;
  onFocalChange: (focal: { x: number; y: number }) => void;
  onFocalReset: () => void;
};

function displayFocal(image: EventImageRow): { x: number; y: number } {
  return {
    x: image.focalX ?? 50,
    y: image.focalY ?? 50,
  };
}

function focalFromClick(e: React.MouseEvent<HTMLButtonElement>): {
  x: number;
  y: number;
} {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
  const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

  return {
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y)),
  };
}

export function EventImageFocalPreview({
  image,
  disabled,
  isHero,
  onFocalChange,
  onFocalReset,
}: EventImageFocalPreviewProps) {
  const focal = displayFocal(image);
  const hasCustomFocal = image.focalX != null && image.focalY != null;

  return (
    <div className="space-y-1">
      <Button
        aria-label="Set crop focal point"
        className={clsx(
          "relative block w-full h-auto aspect-video p-0 overflow-hidden rounded-none",
          "cursor-crosshair",
          disabled && "pointer-events-none opacity-60",
        )}
        disabled={disabled || !image.url}
        type="button"
        variant="ghost"
        onClick={(e) => onFocalChange(focalFromClick(e))}
      >
        {image.url ? (
          <img
            alt=""
            className="w-full h-full object-cover pointer-events-none"
            src={image.url}
            style={{ objectPosition: `${focal.x}% ${focal.y}%` }}
          />
        ) : (
          <div className="flex items-center justify-center h-full min-h-24 text-xs text-muted-foreground px-2 text-center">
            Preview unavailable (check R2_PUBLIC_BASE_URL)
          </div>
        )}
        {image.url ? (
          <span
            aria-hidden
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background/80 pointer-events-none"
            style={{ left: `${focal.x}%`, top: `${focal.y}%` }}
          />
        ) : null}
        {isHero ? (
          <span className="absolute top-1 left-1 text-[10px] uppercase tracking-wide bg-background/90 px-1.5 py-0.5 rounded pointer-events-none">
            Hero
          </span>
        ) : null}
      </Button>
      <div className="flex flex-wrap items-center gap-2 px-2">
        <p className="text-[10px] text-muted-foreground flex-1 min-w-[8rem]">
          Click to set crop focus. Does not change the uploaded file.
        </p>
        <Button
          className="h-auto px-0 py-0 text-[10px] text-muted-foreground"
          disabled={disabled || !hasCustomFocal}
          type="button"
          variant="link"
          onClick={onFocalReset}
        >
          Reset to center
        </Button>
      </div>
    </div>
  );
}
