import type { ReactNode } from "react";

/**
 * Parses a string containing `{{highlighted}}` markers and renders
 * the marked portions with neon styling.
 *
 * Works in any content field — no need for separate highlight metadata.
 * Strapi-compatible: content editors just wrap text in `{{double braces}}`.
 *
 * Usage:
 *   <NeonText text="The dancefloor is {{an idea}}, not a location." />
 */
export function NeonText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return <span className={className}>{parseNeonMarkers(text)}</span>;
}

/** Parse `{{…}}` markers into React elements with neon highlighting. */
export function parseNeonMarkers(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\{\{(.+?)\}\}/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before the marker
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Highlighted portion
    parts.push(
      <span key={match.index} className="neon-text font-normal">
        {match[1]}
      </span>,
    );
    lastIndex = regex.lastIndex;
  }

  // Remaining text after last marker
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
