import type { InternalLinkBlock } from "@/lib/content/types";

import NextLink from "next/link";

export function InternalLinkBlockComponent({
  label,
  href,
  locale,
}: InternalLinkBlock & { locale: string }) {
  return (
    <div className="mt-14">
      <NextLink
        className="inline-flex items-center gap-3 text-xs font-mono uppercase tracking-widest text-neon/60 hover:text-neon transition-colors duration-300"
        href={`/${locale}${href}`}
      >
        {label}
        <span aria-hidden="true">&rarr;</span>
      </NextLink>
    </div>
  );
}
