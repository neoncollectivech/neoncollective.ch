import type { CtaLinkBlock } from "@/lib/content/types";

import { NeonLink } from "@/components/neon-link";

export function CtaLinkBlockComponent({ label, href, external }: CtaLinkBlock) {
  const isExternal = external ?? href.startsWith("http");

  return (
    <div className="my-14">
      <NeonLink href={href} isExternal={isExternal}>
        {label}
      </NeonLink>
    </div>
  );
}
