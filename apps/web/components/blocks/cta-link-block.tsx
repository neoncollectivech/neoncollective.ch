import type { CtaLinkBlock } from "@/lib/content/types";

import { ContentCtaLink } from "@/components/content-cta-link";

export function CtaLinkBlockComponent({ label, href, external }: CtaLinkBlock) {
  return <ContentCtaLink external={external} href={href} label={label} />;
}
