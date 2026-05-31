import { buildR2ImageProps } from "@/helpers/event-image-url";

type ResponsiveEventImageProps = {
  url: string;
  alt: string;
  sizes: string;
  loading?: "lazy" | "eager";
  className?: string;
};

export function ResponsiveEventImage({
  url,
  alt,
  sizes,
  loading = "lazy",
  className,
}: ResponsiveEventImageProps) {
  const { src, srcSet, sizes: sizesAttr } = buildR2ImageProps(url, sizes);

  return (
    <img
      alt={alt}
      className={className}
      decoding="async"
      loading={loading}
      sizes={sizesAttr}
      src={src}
      srcSet={srcSet}
    />
  );
}
