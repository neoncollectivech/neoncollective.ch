import type { SectionBlock } from "@/lib/content/types";

import { Markdown } from "@/components/markdown";
import { NeonLink } from "@/components/neon-link";

export function SectionBlockComponent({
  number,
  title,
  subtitle,
  intro,
  body,
  points,
  cta,
}: SectionBlock) {
  return (
    <section className="mb-16 md:mb-24">
      <div className="neon-line w-12 mb-8" />

      {number && (
        <span className="block text-xs font-mono text-neon/40 tracking-[0.3em] uppercase mb-3">
          {number}.
        </span>
      )}

      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-foreground/90 mb-1">
        {title}
      </h2>

      <h3 className="text-base md:text-lg text-foreground/35 font-light mb-8">
        {subtitle}
      </h3>

      {intro && (
        <p className="text-base md:text-lg text-foreground/50 leading-relaxed mb-12 max-w-2xl italic">
          {intro}
        </p>
      )}

      {body && (
        <div className="text-base md:text-lg text-foreground/40 leading-relaxed">
          <Markdown content={body} />
        </div>
      )}

      {points && points.length > 0 && (
        <div className="space-y-10">
          {points.map((point, i) => (
            <div
              key={i}
              className="pl-6 border-l border-white/[0.06] hover:border-neon/30 transition-colors duration-500"
            >
              <h4 className="text-sm font-mono font-medium text-foreground/70 mb-2 tracking-wide">
                {point.title}
              </h4>
              <p className="text-base text-foreground/40 leading-relaxed">
                {point.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {cta && (
        <div className="my-14">
          <NeonLink href={cta.href} isExternal={cta.href.startsWith("http")}>
            {cta.label}
          </NeonLink>
        </div>
      )}
    </section>
  );
}
