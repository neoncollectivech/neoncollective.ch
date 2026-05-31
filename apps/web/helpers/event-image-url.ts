export const R2_IMAGE_WIDTH_STEP = 250;
export const R2_IMAGE_MAX_WIDTH = 2000;
export const R2_IMAGE_DEFAULT_WIDTH = 500;
export const R2_IMAGE_QUALITY = 85;

const CF_IMAGE_PATH = "/cdn-cgi/image/";

function normalizeBaseUrl(base: string): string {
  return base.replace(/\/+$/, "");
}

function getR2PublicBaseUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim();

  if (!raw) {
    return undefined;
  }

  return normalizeBaseUrl(raw);
}

export function isR2PublicImageUrl(url: string): boolean {
  const base = getR2PublicBaseUrl();

  if (!base) {
    return false;
  }
  try {
    const parsed = new URL(url);
    const baseUrl = new URL(base);

    return (
      parsed.origin === baseUrl.origin &&
      parsed.pathname.startsWith("/") &&
      !parsed.pathname.startsWith(CF_IMAGE_PATH)
    );
  } catch {
    return false;
  }
}

export function extractR2ObjectPath(publicUrl: string): string | undefined {
  const base = getR2PublicBaseUrl();

  if (!base) {
    return undefined;
  }
  try {
    const parsed = new URL(publicUrl);
    const baseUrl = new URL(`${base}/`);

    if (parsed.origin !== baseUrl.origin) {
      return undefined;
    }
    const path = parsed.pathname.replace(/^\/+/, "");

    return path.length > 0 ? path : undefined;
  } catch {
    return undefined;
  }
}

/** Width candidates for srcset: 250, 500, … up to R2_IMAGE_MAX_WIDTH. */
export function r2ImageSrcWidths(): number[] {
  const widths: number[] = [];

  for (
    let w = R2_IMAGE_WIDTH_STEP;
    w <= R2_IMAGE_MAX_WIDTH;
    w += R2_IMAGE_WIDTH_STEP
  ) {
    widths.push(w);
  }

  return widths;
}

/**
 * Cloudflare resize URL. Uses fit=scale-down so originals smaller than `width`
 * are never upscaled (CF returns native dimensions).
 */
export function buildR2ResizedUrl(publicUrl: string, width: number): string {
  if (publicUrl.includes(CF_IMAGE_PATH)) {
    return publicUrl;
  }

  const base = getR2PublicBaseUrl();
  const objectPath = extractR2ObjectPath(publicUrl);

  if (!base || !objectPath) {
    return publicUrl;
  }

  const options = [
    "fit=scale-down",
    `width=${width}`,
    "format=auto",
    `quality=${R2_IMAGE_QUALITY}`,
  ].join(",");

  return `${base}${CF_IMAGE_PATH}${options}/${objectPath}`;
}

export function buildR2SrcSet(publicUrl: string): string | undefined {
  if (!isR2PublicImageUrl(publicUrl)) {
    return undefined;
  }

  return r2ImageSrcWidths()
    .map((w) => `${buildR2ResizedUrl(publicUrl, w)} ${w}w`)
    .join(", ");
}

export type R2ImageProps = {
  src: string;
  srcSet?: string;
  sizes?: string;
};

export function buildR2ImageProps(
  publicUrl: string,
  sizes: string,
): R2ImageProps {
  if (!isR2PublicImageUrl(publicUrl)) {
    return { src: publicUrl };
  }

  const srcSet = buildR2SrcSet(publicUrl);

  if (!srcSet) {
    return { src: publicUrl };
  }

  return {
    src: buildR2ResizedUrl(publicUrl, R2_IMAGE_DEFAULT_WIDTH),
    srcSet,
    sizes,
  };
}
