import type { ReactNode } from "react";

interface NeonHeroProps {
  /** Main title — pass <NeonHeroTitle /> for the animated landing hero,
   *  or a string like "404" for a static neon-outlined heading. */
  title: ReactNode;
  /** Mono uppercase subtitle below the title */
  subtitle?: string;
  /** Small description text below the subtitle */
  description?: string;
  /** Full viewport height with navbar offset (landing page hero) */
  fullHeight?: boolean;
  /** Additional content — scroll indicator, neon-line + CTA, etc. */
  children?: ReactNode;
}

/**
 * Centered hero section with neon display title.
 *
 * When `title` is a string it renders as a `<h1>` with neon outline stroke
 * and the flicker-glow animation. When it's a ReactNode (e.g. `<NeonHeroTitle />`),
 * it's rendered as-is.
 */
export function NeonHero({
  title,
  subtitle,
  description,
  fullHeight = false,
  children,
}: NeonHeroProps) {
  return (
    <section
      className={
        "flex flex-col items-center justify-center px-6" +
        (fullHeight ? " h-dvh -mt-16 relative" : " min-h-[60vh]")
      }
    >
      <div className="text-center">
        {typeof title === "string" ? (
          <h1
            className="text-7xl md:text-8xl lg:text-[10rem] font-display font-black tracking-display leading-none text-transparent neon-flicker-glow"
            style={{
              WebkitTextStroke: "1.5px rgb(var(--neon))",
              textIndent: "0.25em",
            }}
          >
            {title}
          </h1>
        ) : (
          title
        )}
        {subtitle && (
          <p
            className="mt-8 text-[0.6875rem] md:text-xs font-mono text-foreground/30 uppercase tracking-[0.35em]"
            style={{ textIndent: "0.35em" }}
          >
            {subtitle}
          </p>
        )}
        {description && (
          <p className="mt-3 text-sm text-foreground/15">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
