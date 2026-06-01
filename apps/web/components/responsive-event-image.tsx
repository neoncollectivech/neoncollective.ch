import { buildR2ImageProps } from "@/helpers/event-image-url";
import {
  objectPositionFromFocal,
  type EventImageFocal,
} from "@/helpers/event-image-focal";
type ResponsiveEventImageProps = {
  url: string;
  alt: string;
  sizes: string;
  loading?: "lazy" | "eager";
  className?: string;
  focal?: EventImageFocal | null;
};

export function ResponsiveEventImage({
  url,
  alt,
  sizes,
  loading = "lazy",
  className,
  focal = null,
}: ResponsiveEventImageProps) {
  const { src, srcSet, sizes: sizesAttr } = buildR2ImageProps(url, sizes);
  const usesCover = className?.includes("object-cover") ?? false;

  return (
    <img
      alt={alt}
      className={className}
      decoding="async"
      loading={loading}
      sizes={sizesAttr}
      src={src}
      srcSet={srcSet}
      style={
        usesCover
          ? { objectPosition: objectPositionFromFocal(focal) }
          : undefined
      }
    />
  );
}
