import type { NeonQuoteBlock } from "@/lib/content/types";

import { parseNeonMarkers } from "@/components/neon-text";

export function NeonQuoteBlockComponent({ lines }: NeonQuoteBlock) {
  return (
    <div>
      {lines.map((line, i) => (
        <p
          key={i}
          className={`${i > 0 ? "mt-8 " : ""}text-2xl md:text-3xl lg:text-4xl font-light leading-snug text-foreground/70`}
        >
          {parseNeonMarkers(line)}
        </p>
      ))}
    </div>
  );
}
