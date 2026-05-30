import type { InternalLinkBlock } from "@/lib/content/types";

import { ContentCtaLink } from "@/components/content-cta-link";

export function InternalLinkBlockComponent({
  label,
  href,
  locale,
}: InternalLinkBlock & { locale: string }) {
  return (
    <ContentCtaLink
      showArrow
      className="mt-14"
      href={href}
      label={label}
      locale={locale}
      neonStyle="inline"
    />
  );
}
