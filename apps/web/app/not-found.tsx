import { NeonHero } from "@/components/neon-hero";
import { RootNotFoundCta } from "@/components/root-not-found-cta";

/**
 * Root-level 404 page.
 *
 * With `output: "export"`, Next.js generates `404.html` from this file.
 * GitHub Pages serves it for any unmatched URL.
 *
 * Only the root layout (fonts + global CSS) wraps this page — the CTA uses a
 * minimal HeroUIProvider so NeonLink renders correctly.
 */
export default function RootNotFound() {
  return (
    <NeonHero fullHeight subtitle="Signal lost" title="404">
      <div className="neon-line w-12 mt-10" />
      <RootNotFoundCta />
    </NeonHero>
  );
}
