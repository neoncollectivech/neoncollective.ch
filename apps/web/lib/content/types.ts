/** Content types — block-based content system. */

/* ── Content Block Types ───────────────────────────────────── */

/** Base interface for all content blocks. */
export interface BlockBase {
  component: string;
}

export interface HeroBlock extends BlockBase {
  component: "hero";
  /** true = use animated NeonHeroTitle. */
  animated?: boolean;
  title?: string;
  subtitle?: string;
  fullHeight?: boolean;
}

export interface HeadingBlock extends BlockBase {
  component: "heading";
  text: string;
  level: 1 | 2 | 3;
  /**
   * "mono"     — small mono uppercase tracking (page titles like Engage).
   * "semibold" — subtitle style (Contact).
   * "default"  — bold display heading.
   */
  variant?: "default" | "mono" | "semibold";
}

export interface MarkdownBlock extends BlockBase {
  component: "markdown";
  content: string;
}

export interface NeonQuoteBlock extends BlockBase {
  component: "neonQuote";
  /** Each line supports {{markers}} for neon highlighting. */
  lines: string[];
}

export interface CtaLinkBlock extends BlockBase {
  component: "ctaLink";
  label: string;
  href: string;
  external?: boolean;
}

export interface InternalLinkBlock extends BlockBase {
  component: "internalLink";
  label: string;
  /** Locale-relative path (e.g., "/manifesto"). */
  href: string;
}

export interface SectionBlock extends BlockBase {
  component: "section";
  number?: string;
  title: string;
  subtitle: string;
  intro?: string;
  /** Markdown body — used by Engage-style sections. */
  body?: string;
  /** Structured points — used by Manifesto-style sections. */
  points?: { title: string; text: string }[];
  cta?: { label: string; href: string };
}

export interface TextBlock extends BlockBase {
  component: "text";
  text: string;
  italic?: boolean;
}

export interface NeonLineBlock extends BlockBase {
  component: "neonLine";
  width?: string;
}

export interface SpacerBlock extends BlockBase {
  component: "spacer";
  size?: "sm" | "md" | "lg";
}

/** Small mono meta text — e.g. "Last updated" dates. */
export interface MetaTextBlock extends BlockBase {
  component: "metaText";
  text: string;
}

/** Single entry in the intervention dispatch feed. */
export interface InterventionEntry {
  codename: string;
  status: "incubation" | "live" | "archived";
  objective: string;
  location: string;
  coordinates?: string;
  cta?: { label: string; href: string; external?: boolean };
}

/** Tactical dispatch feed — renders a live-feeling intelligence dashboard. */
export interface InterventionFeedBlock extends BlockBase {
  component: "interventionFeed";
  entries: InterventionEntry[];
}

/** Marker block — renders the DonationPicker client component. Labels come from i18n messages. */
export interface DonationPickerBlock extends BlockBase {
  component: "donationPicker";
}

/** Marker block — renders the ManageDonation client component. Labels come from i18n messages. */
export interface ManageDonationBlock extends BlockBase {
  component: "manageDonation";
}

export type ContentBlock =
  | HeroBlock
  | HeadingBlock
  | MarkdownBlock
  | NeonQuoteBlock
  | CtaLinkBlock
  | InternalLinkBlock
  | SectionBlock
  | TextBlock
  | NeonLineBlock
  | SpacerBlock
  | MetaTextBlock
  | InterventionFeedBlock
  | DonationPickerBlock
  | ManageDonationBlock;

/* ── Page Content ──────────────────────────────────────────── */

/** Standardized page content shape: metadata + blocks array. */
export interface PageContent {
  meta: { title: string; description?: string };
  blocks: ContentBlock[];
}

/* ── Slug-to-content mapping ─────────────────────────────── */

/** Type-safe slug-to-content mapping. */
export interface ContentMap {
  home: PageContent;
  manifesto: PageContent;
  engage: PageContent;
  contact: PageContent;
  impressum: PageContent;
  "privacy-policy": PageContent;
  donate: PageContent;
}
