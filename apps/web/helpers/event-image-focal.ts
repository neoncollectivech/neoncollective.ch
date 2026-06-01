export type EventImageFocal = { x: number; y: number };

export type EventImage = {
  url: string;
  focal: EventImageFocal | null;
};

export function objectPositionFromFocal(focal: EventImageFocal | null): string {
  if (!focal) {
    return "50% 50%";
  }

  return `${focal.x}% ${focal.y}%`;
}

function isValidFocalCoord(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 100
  );
}

export function parsePublicEventImage(raw: unknown): EventImage | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as { url?: unknown; focal?: unknown };
  const url = typeof record.url === "string" ? record.url.trim() : "";

  if (!url) {
    return null;
  }

  const focalRaw = record.focal;

  if (!focalRaw || typeof focalRaw !== "object") {
    return { url, focal: null };
  }

  const focalRecord = focalRaw as { x?: unknown; y?: unknown };

  if (isValidFocalCoord(focalRecord.x) && isValidFocalCoord(focalRecord.y)) {
    return { url, focal: { x: focalRecord.x, y: focalRecord.y } };
  }

  return { url, focal: null };
}

export function parsePublicEventImages(raw: unknown): EventImage[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const images: EventImage[] = [];

  for (const item of raw) {
    const parsed = parsePublicEventImage(item);

    if (parsed) {
      images.push(parsed);
    }
  }

  return images;
}
