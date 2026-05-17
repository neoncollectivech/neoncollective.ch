import type { MetaTextBlock } from "@/lib/content/types";

export function MetaTextBlockComponent({ text }: MetaTextBlock) {
  return <p className="text-xs font-mono text-foreground/30">{text}</p>;
}
