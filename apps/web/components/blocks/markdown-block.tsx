import type { MarkdownBlock } from "@/lib/content/types";

import { Markdown } from "@/components/markdown";

export function MarkdownBlockComponent({ content }: MarkdownBlock) {
  return (
    <div>
      <Markdown content={content} />
    </div>
  );
}
