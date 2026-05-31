/** Max upload size per event image (8 MiB). */
export const MAX_EVENT_IMAGE_BYTES = 8 * 1024 * 1024;

export const ALLOWED_EVENT_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type AllowedEventImageContentType =
  (typeof ALLOWED_EVENT_IMAGE_CONTENT_TYPES)[number];

/** Max images attached to one event. */
export const MAX_EVENT_IMAGES_PER_EVENT = 12;

const CONTENT_TYPE_TO_EXT: Record<AllowedEventImageContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export function isAllowedEventImageContentType(
  value: string,
): value is AllowedEventImageContentType {
  return (ALLOWED_EVENT_IMAGE_CONTENT_TYPES as readonly string[]).includes(value);
}

export function extensionForEventImageContentType(
  contentType: AllowedEventImageContentType,
): string {
  return CONTENT_TYPE_TO_EXT[contentType];
}
