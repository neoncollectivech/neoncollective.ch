import type { ComponentProps, ReactNode } from "react";

import { NeonLink } from "@/components/neon-link";

type ContentCtaLinkProps = {
  label: ReactNode;
  href: string;
  className?: string;
  locale?: string;
  external?: boolean;
  neonStyle?: ComponentProps<typeof NeonLink>["neonStyle"];
  showArrow?: boolean;
};

export function ContentCtaLink({
  label,
  href,
  className = "my-14",
  locale,
  external,
  neonStyle,
  showArrow = false,
}: ContentCtaLinkProps) {
  const isExternal = external ?? href.startsWith("http");
  const resolvedHref = locale && !isExternal ? `/${locale}${href}` : href;

  return (
    <div className={className}>
      <NeonLink
        href={resolvedHref}
        isExternal={isExternal}
        neonStyle={neonStyle}
      >
        {label}
        {showArrow ? <span aria-hidden="true">&rarr;</span> : null}
      </NeonLink>
    </div>
  );
}
