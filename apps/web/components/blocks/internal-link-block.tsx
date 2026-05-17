import type { InternalLinkBlock } from "@/lib/content/types";

import { NeonLink } from "@/components/neon-link";

export function InternalLinkBlockComponent({
  label,
  href,
  locale,
}: InternalLinkBlock & { locale: string }) {
  return (
    <div className="mt-14">
      <NeonLink href={`/${locale}${href}`} neonStyle="inline">
        {label}
        <span aria-hidden="true">&rarr;</span>
      </NeonLink>
    </div>
  );
}
