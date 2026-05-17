import type { HeroBlock } from "@/lib/content/types";

import { NeonHero } from "@/components/neon-hero";
import { NeonHeroTitle } from "@/components/neon-hero-title";

export function HeroBlockComponent({
  animated,
  title,
  subtitle,
  fullHeight,
}: HeroBlock) {
  return (
    <NeonHero
      fullHeight={fullHeight}
      subtitle={subtitle}
      title={animated ? <NeonHeroTitle /> : (title ?? "")}
    >
      {fullHeight && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
          <div className="w-px h-14 bg-gradient-to-b from-transparent to-neon/30 animate-pulse-line" />
        </div>
      )}
    </NeonHero>
  );
}
