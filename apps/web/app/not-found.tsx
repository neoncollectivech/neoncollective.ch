import NextLink from "next/link";

import { NeonHero } from "@/components/neon-hero";

/**
 * Root-level 404 page.
 *
 * With `output: "export"`, Next.js generates `404.html` from this file.
 * GitHub Pages serves it for any unmatched URL.
 *
 * No HeroUI Provider or DictionaryProvider is available here —
 * only the root layout (fonts + global CSS).
 */
export default function RootNotFound() {
  return (
    <NeonHero fullHeight subtitle="Signal lost" title="404">
      <div className="neon-line w-12 mt-10" />
      <NextLink
        className="mt-10 inline-block border border-neon/60 px-8 py-3 text-xs font-mono uppercase tracking-widest text-neon leading-none hover:bg-neon/10 hover:border-neon no-underline transition-all duration-300"
        href="/"
      >
        Go home
      </NextLink>
    </NeonHero>
  );
}
