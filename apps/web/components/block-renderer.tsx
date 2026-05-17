import type { ComponentType } from "react";
import type { ContentBlock } from "@/lib/content/types";

import {
  HeroBlockComponent,
  HeadingBlockComponent,
  MarkdownBlockComponent,
  NeonQuoteBlockComponent,
  CtaLinkBlockComponent,
  InternalLinkBlockComponent,
  SectionBlockComponent,
  TextBlockComponent,
  NeonLineBlockComponent,
  SpacerBlockComponent,
  MetaTextBlockComponent,
  DonationPickerBlockComponent,
  ManageDonationBlockComponent,
  InterventionFeedBlockComponent,
} from "@/components/blocks";

/* eslint-disable @typescript-eslint/no-explicit-any */
const BLOCK_REGISTRY: Record<string, ComponentType<any>> = {
  hero: HeroBlockComponent,
  heading: HeadingBlockComponent,
  markdown: MarkdownBlockComponent,
  neonQuote: NeonQuoteBlockComponent,
  ctaLink: CtaLinkBlockComponent,
  internalLink: InternalLinkBlockComponent,
  section: SectionBlockComponent,
  text: TextBlockComponent,
  neonLine: NeonLineBlockComponent,
  spacer: SpacerBlockComponent,
  metaText: MetaTextBlockComponent,
  donationPicker: DonationPickerBlockComponent,
  manageDonation: ManageDonationBlockComponent,
  interventionFeed: InterventionFeedBlockComponent,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

interface BlockRendererProps {
  blocks: ContentBlock[];
  locale: string;
}

/**
 * Renders an array of content blocks by looking up each block's `component`
 * field in the registry and delegating to the matching React component.
 */
export function BlockRenderer({ blocks, locale }: BlockRendererProps) {
  return (
    <>
      {blocks.map((block, i) => {
        const Component = BLOCK_REGISTRY[block.component];

        if (!Component) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              `[BlockRenderer] Unknown block type: "${block.component}"`,
            );
          }

          return null;
        }

        return (
          <Component
            key={`${block.component}-${i}`}
            locale={locale}
            {...block}
          />
        );
      })}
    </>
  );
}
